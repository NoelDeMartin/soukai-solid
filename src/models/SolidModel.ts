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

    public static ldpContainer: boolean;

    public static rdfContexts: { [alias: string]: string } = {};

    public static rdfsClasses: string[] | Set<string> = [];

    public static mintsUrls: boolean = true;

    protected static instance: SolidModel;

    protected static pureInstance: SolidModel;

    public static from(containerUrl: string): typeof SolidModel {
        this.collection = containerUrl;

        return this;
    }

    public static at(containerUrl: string): typeof SolidModel {
        return this.from(containerUrl);
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

        const ldpResource = this.instance.resolveRDFAlias('ldp:Resource');
        if (!this.rdfsClasses.has(ldpResource)) {
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
        return this.instance.withCollection(Url.parentDirectory(id), () => super.find(id));
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

        return super.all(filters);
    }

    protected classDef: typeof SolidModel;

    public save<T extends Model>(containerUrl?: string): Promise<T> {
        if (this.classDef.mintsUrls && !this.hasAttribute(this.classDef.primaryKey)) {
            const urlPath = (this.classDef.ldpContainer && this.hasAttribute('name'))
                ? Str.slug(this.getAttribute('name'))
                : UUID.generate();

            this.setAttribute(
                this.classDef.primaryKey,
                this.classDef.ldpContainer
                    ? Url.resolveDirectory(containerUrl || this.classDef.collection, urlPath)
                    : Url.resolve(containerUrl || this.classDef.collection, urlPath),
            );
        }

        return this.withCollection(containerUrl, () => super.save());
    }

    public delete<T extends Model>(): Promise<T> {
        return this.withCollection(() => super.delete());
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

    private withCollection<Result>(collection: string | (() => Result) = '', method?: () => Result): Result {
        const classDef = this.constructor as typeof SolidModel;
        const oldCollection = classDef.collection;

        if (typeof collection !== 'string') {
            method = collection;
            collection = '';
        }

        if (!method) {
            throw new SoukaiError('Invalid method given to withCollection (SolidModel internals)');
        }

        if (collection) {
            classDef.collection = collection;
        } else if (this.url) {
            classDef.collection = Url.parentDirectory(this.url);
        }

        const result = method();

        classDef.collection = oldCollection;

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
