import {
    Attributes,
    EngineAttributes,
    FieldDefinition,
    FieldsDefinition,
    FieldType,
    Filters,
    Model,
    MultiModelRelation,
    SingleModelRelation,
    SoukaiError,
} from 'soukai';

import SolidHasManyRelation from '@/models/relations/SolidHasManyRelation';
import SolidIsContainedByRelation from '@/models/relations/SolidIsContainedByRelation';

import Str from '@/utils/Str';
import Url from '@/utils/Url';
import UUID from '@/utils/UUID';

export interface SolidFieldsDefinition extends FieldsDefinition {
    [field: string]: SolidFieldDefinition;
}

export interface SolidFieldDefinition extends FieldDefinition {
    rdfProperty?: string;
}

export default class SolidModel extends Model {

    public static primaryKey: string = 'url';

    public static fields: SolidFieldsDefinition | any;

    public static ldpResource: boolean;

    public static ldpContainer: boolean;

    public static rdfContexts: { [alias: string]: string } = {};

    public static rdfsClasses: string[] | Set<string> = [];

    public static mintsUrls: boolean = true;

    protected static instance: SolidModel;

    protected static pureInstance: SolidModel;

    public static from(parentUrl: string): typeof SolidModel {
        this.collection = parentUrl;

        return this;
    }

    public static at(parentUrl: string): typeof SolidModel {
        return this.from(parentUrl);
    }

    public static boot(name: string): void {
        super.boot(name);

        this.rdfContexts = {
            ...this.rdfContexts,
            solid: 'http://www.w3.org/ns/solid/terms#',
            rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
            rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
            ldp: 'http://www.w3.org/ns/ldp#',
        };

        const defaultRdfContext = this.instance.getDefaultRdfContext();

        if (
            this.instance.hasAutomaticTimestamp('createdAt') &&
            typeof this.fields['createdAt'].rdfProperty === 'undefined'
        ) {
            this.fields['createdAt'].rdfProperty = 'http://purl.org/dc/terms/created';
        }

        if (
            this.instance.hasAutomaticTimestamp('updatedAt') &&
            typeof this.fields['updatedAt'].rdfProperty === 'undefined'
        ) {
            this.fields['updatedAt'].rdfProperty = 'http://purl.org/dc/terms/modified';
        }

        this.rdfsClasses = new Set([...this.rdfsClasses].map(
            expression => this.instance.resolveRDFAlias(expression)
        ));

        this.ldpResource = this.ldpResource || this.ldpResource === undefined;
        this.ldpContainer = !!this.ldpContainer;

        if (this.ldpResource) {
            const ldpResource = this.instance.resolveRDFAlias('ldp:Resource');

            if (!this.rdfsClasses.has(ldpResource))
                this.rdfsClasses.add(ldpResource);
        }

        if (this.ldpContainer) {
            const ldpContainerType = this.instance.resolveRDFAlias('ldp:Container');

            if (!this.rdfsClasses.has(ldpContainerType)) {
                this.rdfsClasses.add(ldpContainerType);
            }

            this.fields['resourceUrls'] = {
                type: FieldType.Array,
                required: false,
                rdfProperty: 'http://www.w3.org/ns/ldp#contains',
                items: {
                    type: FieldType.Key,
                },
            };
        }

        for (const field in this.fields) {
            this.fields[field].rdfProperty = this.instance.resolveRDFAlias(
                this.fields[field].rdfProperty || `${defaultRdfContext}${field}`,
            );
        }

        this.fields[this.primaryKey].rdfProperty = null;
    }

    public static find<T extends Model>(id: string): Promise<T | null> {
        return this.withCollection(Url.parentDirectory(id), () => super.find(id));
    }

    public static all<T extends Model>(filters: Filters = {}): Promise<T[]> {
        // TODO translate filters from attributes to jsonld specification

        const types: { '@id': string }[] = [];
        for (const rdfClass of this.rdfsClasses) {
            types.push({ '@id': rdfClass });
        }

        filters['@type'] = {
            $contains: types,
        };

        return this.withCollection(() => super.all(filters));
    }

    protected classDef: typeof SolidModel;

    public save<T extends Model>(parentUrl?: string): Promise<T> {
        if (this.classDef.mintsUrls && !this.hasAttribute(this.classDef.primaryKey))
            this.setAttribute(this.classDef.primaryKey, this.newUrl(parentUrl));

        return this.classDef.withCollection(
            parentUrl || this.getParentUrl(),
            () => super.save(),
        );
    }

    public delete<T extends Model>(): Promise<T> {
        return this.classDef.withCollection(this.getParentUrl() || '', () => super.delete());
    }

    public getIdAttribute(): string {
        return this.getAttribute('url');
    }

    protected hasMany(model: typeof SolidModel, linksField: string): MultiModelRelation {
        return new SolidHasManyRelation(this, model, linksField);
    }

    protected contains(model: typeof SolidModel): MultiModelRelation {
        return this.hasMany(model, 'resourceUrls');
    }

    protected isContainedBy(model: typeof SolidModel): SingleModelRelation {
        return new SolidIsContainedByRelation(this, model);
    }

    protected getDefaultRdfContext(): string {
        return Object.values(this.classDef.rdfContexts).shift() || '';
    }

    protected prepareEngineAttributes(attributes: Attributes): EngineAttributes {
        const jsonld = this.convertAttributesToJsonLD(attributes) as EngineAttributes;

        // We only need to send the types when the model is being created, because we
        // assume they won't be changed.
        if ('@id' in jsonld || !this.exists) {
            const types: { '@id': string }[] = [];
            for (const rdfClass of this.classDef.rdfsClasses) {
                types.push({ '@id': rdfClass });
            }

            jsonld['@type'] = types;
        }

        return jsonld;
    }

    protected prepareEngineAttributeNames(names: string[]): string[] {
        const fieldsDefinition = this.classDef.fields;

        return names
            .map(name => {
                const fieldDefinition = fieldsDefinition[name];

                if (!fieldDefinition) {
                    return this.getDefaultRdfContext() + name;
                }

                return fieldDefinition.rdfProperty;
            })
            .filter(name => name !== null);
    }

    protected parseEngineAttributes(attributes: EngineAttributes): Attributes {
        return this.convertJsonLDToAttributes(attributes);
    }

    protected castAttribute(value: any, definition?: FieldDefinition): any {
        if (definition && definition.type === FieldType.Array && !Array.isArray(value)) {
            return [value];
        }

        return super.castAttribute(value, definition);
    }

    protected newUrl(parentUrl?: string): string {
        parentUrl = parentUrl || this.classDef.collection;

        if (this.classDef.ldpContainer)
            return Url.resolveDirectory(
                parentUrl,
                this.hasAttribute('name')
                    ? Str.slug(this.getAttribute('name'))
                    : UUID.generate(),
            );

        if (this.classDef.ldpResource)
            return Url.resolve(parentUrl, UUID.generate());

        return parentUrl + '#' + UUID.generate();
    }

    private getParentUrl(): string | undefined {
        if (!this.url)
            return;

        if (!this.classDef.ldpResource)
            return Url.clean(this.url, { fragment: false });

        return Url.parentDirectory(this.url);
    }

    private resolveRDFAlias(type: string): string {
        const index = type.indexOf(':');

        if (index !== -1) {
            const prefix = type.substr(0, index);

            for (const alias in this.classDef.rdfContexts) {
                if (prefix === alias) {
                    return this.classDef.rdfContexts[alias] + type.substr(index + 1);
                }
            }
        }

        return type;
    }

    private static withCollection<Result>(collection: string | (() => Result) = '', operation?: () => Result): Result {
        const oldCollection = this.collection;

        if (typeof collection !== 'string') {
            operation = collection;
            collection = '';
        }

        if (!operation)
            throw new SoukaiError('Invalid method given to withCollection (SolidModel internals)');

        this.collection = collection || oldCollection;

        const result = operation();

        this.collection = oldCollection;

        return result;
    }

    private convertAttributesToJsonLD(attributes: Attributes): object {
        const jsonld = {};
        const fieldsDefinition = this.classDef.fields;

        for (const field in attributes) {
            const fieldDefinition = fieldsDefinition[field];
            const value = attributes[field];

            if (field === this.classDef.primaryKey) {
                jsonld['@id'] = value.toString();
                continue;
            }

            const fieldRdfProperty = fieldDefinition
                ? fieldDefinition.rdfProperty as (string | null)
                : this.getDefaultRdfContext() + field;

            if (fieldRdfProperty === null) {
                continue;
            }

            const jsonValue = this.convertAttributeToJsonLD(fieldDefinition, value);

            if (jsonValue !== undefined) {
                jsonld[fieldRdfProperty] = jsonValue;
            }
        }

        return jsonld;
    }

    private convertAttributeToJsonLD(definition: SolidFieldDefinition | undefined, value: any): any {
        const fieldType = definition ? definition.type : null;

        switch (fieldType) {
            case FieldType.Key:
                return { '@id': value.toString() };
            case FieldType.Date:
                return new Date(value);
            case FieldType.Array:
                switch (value.length) {
                    case 0:
                        // nothing to do here
                        return;
                    case 1:
                        return this.convertAttributeToJsonLD(definition!.items!, value[0]);
                    default:
                        return value.map(v => this.convertAttributeToJsonLD(definition!.items!, v));
                }
                break;
            // TODO convert object fields as well
            default:
                return JSON.parse(JSON.stringify(value));
        }
    }

    private convertJsonLDToAttributes(jsonld: object): Attributes {
        const attributes: Attributes = {};
        const fieldsDefinition = this.classDef.fields;

        attributes[this.classDef.primaryKey] = jsonld['@id'];

        for (const field in fieldsDefinition) {
            const fieldDefinition = fieldsDefinition[field];

            if (fieldDefinition.rdfProperty === null) {
                continue;
            }

            const property = jsonld[fieldDefinition.rdfProperty];

            if (typeof property !== 'undefined') {
                attributes[field] = this.convertJsonLDToAttribute(property);
            }
        }

        if (!('@type' in jsonld)) {
            throw new SoukaiError('@type missing from jsonld attributes');
        }

        const types = Array.isArray(jsonld['@type'])
            ? jsonld['@type'].map(type => type['@id'])
            : [jsonld['@type']['@id']];

        for (const rdfClass of this.classDef.rdfsClasses) {
            if (types.indexOf(rdfClass) === -1) {
                throw new SoukaiError(`type ${rdfClass} not found in attributes`);
            }
        }

        return attributes;
    }

    private convertJsonLDToAttribute(property: any): any {
        if (typeof property === 'object' && '@id' in property) {
            return property['@id'];
        } else if (Array.isArray(property)) {
            return property.map(p => this.convertJsonLDToAttribute(p));
        } else {
            return property;
        }
    }

}
