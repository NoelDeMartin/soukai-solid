import { FieldType } from 'soukai';
import { isObject, toString } from '@noeldemartin/utils';
import type {
    Attributes,
    BootedArrayFieldDefinition,
    BootedFieldDefinition,
    EngineAttributeFilter,
    EngineFilters,
    EngineUpdates,
    Relation,
} from 'soukai';

import type { SolidModel } from '@/models/SolidModel';

import RDFDocument from '@/solid/RDFDocument';
import type { JsonLD } from '@/solid/utils/RDF';

import SolidHasManyRelation from '../relations/SolidHasManyRelation';
import SolidHasOneRelation from '../relations/SolidHasOneRelation';

class EmptyJsonLDValue {}

export class RDFContext {

    private vocabs: {
        name: string;
        propertyPrefix: string;
        iriPrefix: string;
        used: boolean;
    }[];

    public readonly compactIRIs: boolean;

    private declarations: Record<string, unknown> = {};

    public constructor(vocabDefinitions: { [alias: string]: string }, compactIRIs: boolean = true) {
        this.vocabs = Object
            .entries(vocabDefinitions)
            .map(([name, iriPrefix]) => ({
                name,
                iriPrefix,
                propertyPrefix: `${name}:`,
                used: false,
            }));
        this.compactIRIs = compactIRIs;

        this.vocabs[0].name = '@vocab';
        this.vocabs[0].propertyPrefix = '';
        this.vocabs[0].used = true;
    }

    public compactIRI(property: string): string {
        for (const vocab of this.vocabs) {
            if (!property.startsWith(vocab.iriPrefix))
                continue;

            vocab.used = true;

            return `${vocab.propertyPrefix}${property.substr(vocab.iriPrefix.length)}`;
        }

        return property;
    }

    public addDeclaration(name: string, value: Record<string, unknown>): void {
        this.declarations[name] = value;
    }

    public toJsonLD(): Record<string, unknown> {
        const vocabDeclarations = this.vocabs
            .filter(vocab => vocab.used)
            .reduce((context, vocab) => ({
                ...context,
                [vocab.name]: vocab.iriPrefix,
            }), {});

        return {
            ...vocabDeclarations,
            ...this.declarations,
        };
    }

}

export default class SerializesToJsonLD {

    protected serializeToJsonLD(
        this: SolidModel,
        includeRelations: boolean = true,
        rdfContext?: RDFContext,
    ): JsonLD {
        rdfContext = rdfContext || new RDFContext(this.static('rdfContexts'));

        const jsonld: JsonLD = { '@context': {}, '@type': null };

        for (const [field, value] of Object.entries(this.getAttributes())) {
            this.setJsonLDField(jsonld, field, value, rdfContext);
        }

        if (includeRelations)
            this.includeRelatedJsonLDInstances(jsonld, rdfContext);

        this.setJsonLDTypes(jsonld, rdfContext);
        this.setJsonLDContexts(jsonld, rdfContext);

        return jsonld;
    }

    protected async convertJsonLDToAttributes(
        this: SolidModel,
        resourceId: string,
        jsonldOrDocument: JsonLD | RDFDocument,
    ): Promise<Attributes> {
        const document = jsonldOrDocument instanceof RDFDocument
            ? jsonldOrDocument
            : await RDFDocument.fromJsonLD(jsonldOrDocument);
        const resource = document.requireResource(resourceId);
        const fieldsDefinition = this.static('fields');
        const attributes: Attributes = {};

        attributes[this.static('primaryKey')] = resourceId;

        for (const [fieldName, fieldDefinition] of Object.entries(fieldsDefinition)) {
            if (!fieldDefinition.rdfProperty)
                continue;

            const [firstValue, ...otherValues] = resource.getPropertyValues(fieldDefinition.rdfProperty);

            if (typeof firstValue === 'undefined')
                continue;

            attributes[fieldName] = otherValues.length > 0 ? [firstValue, ...otherValues] : firstValue;
        }

        return attributes;
    }

    protected convertEngineFiltersToJsonLD(
        this: SolidModel,
        filters: EngineFilters,
        compactIRIs: boolean,
    ): EngineFilters {
        const jsonldFilters: EngineFilters = {};
        const rdfContext = new RDFContext(this.static('rdfContexts'));
        const expandedTypes = this.static('rdfsClasses');
        const compactedTypes = expandedTypes.map(rdfClass => rdfContext.compactIRI(rdfClass));
        const typeFilters: EngineAttributeFilter[] = [];

        if (expandedTypes.length > 0) {
            typeFilters.push({ $contains: compactedTypes });
            typeFilters.push({ $contains: expandedTypes });
        }

        if (expandedTypes.length === 1) {
            typeFilters.push({ $eq: compactedTypes[0] });
            typeFilters.push({ $eq: expandedTypes[0] });
        }

        if (filters.$in) {
            jsonldFilters.$in = filters.$in;
            delete filters.$in;
        }

        const graphContainsFilters = this.convertAttributeValuesToJsonLD(filters, compactIRIs) as EngineFilters;

        if (typeFilters.length > 0)
            graphContainsFilters['@type'] = { $or: typeFilters };

        if (Object.keys(graphContainsFilters).length > 0)
            jsonldFilters['@graph'] = { $contains: graphContainsFilters };

        return jsonldFilters;
    }

    protected convertEngineUpdatesToJsonLD(
        this: SolidModel,
        updates: EngineUpdates,
        compactIRIs: boolean,
    ): EngineUpdates {
        return this.convertAttributeValuesToJsonLD(updates, compactIRIs) as EngineUpdates;
    }

    protected getFieldRdfProperty(this: SolidModel, field: string): string | null {
        const fieldDefinition = this.static('fields')[field];

        if (fieldDefinition && !fieldDefinition.rdfProperty)
            return null;

        return fieldDefinition
            ? fieldDefinition.rdfProperty as string
            : (this.getDefaultRdfContext() + field);
    }

    private setJsonLDField(
        this: SolidModel,
        jsonld: JsonLD,
        field: string,
        value: unknown,
        rdfContext: RDFContext,
    ): void {
        if (field === this.static('primaryKey')) {
            jsonld['@id'] = toString(value);
            return;
        }

        const fieldDefinition = this.static('fields')[field];
        const propertyName = this.getFieldRdfProperty(field);

        if (!propertyName)
            return;

        this.setJsonLDProperty(
            jsonld,
            rdfContext.compactIRIs ? rdfContext.compactIRI(propertyName) : propertyName,
            value,
            fieldDefinition,
        );
    }

    private includeRelatedJsonLDInstances(
        this: SolidModel,
        jsonld: Record<string, unknown>,
        rdfContext: RDFContext,
    ): void {
        const relations = this
            .static('relations')
            .map(name => [name, this.requireRelation(name)]) as [string, Relation][];

        for (const [relationName, relationInstance] of relations) {
            if (
                !relationInstance.loaded || relationInstance.isEmpty() || (
                    !(relationInstance instanceof SolidHasManyRelation) &&
                    !(relationInstance instanceof SolidHasOneRelation)
                )
            )
                continue;

            const foreignPropertyName = rdfContext.compactIRI(
                relationInstance.relatedClass.instance().getFieldRdfProperty(relationInstance.foreignKeyName) as string,
            );
            const serializeRelatedModel = (model: SolidModel) => {
                const jsonld = model.serializeToJsonLD(false, rdfContext);

                delete jsonld['@context'];
                delete jsonld[foreignPropertyName];

                return jsonld;
            };

            jsonld[relationName] = relationInstance instanceof SolidHasManyRelation
                ? relationInstance.getLoadedModels().map(model => serializeRelatedModel(model as SolidModel))
                : serializeRelatedModel(relationInstance.related as SolidModel);

            rdfContext.addDeclaration(relationName, { '@reverse': foreignPropertyName });
        }
    }

    private setJsonLDTypes(this: SolidModel, jsonld: Record<string, unknown>, rdfContext: RDFContext): void {
        const types = this.static('rdfsClasses').map(rdfsClass => rdfContext.compactIRI(rdfsClass));

        if (types.length === 1)
            jsonld['@type'] = types[0];
        else if (types.length > 0)
            jsonld['@type'] = types;
    }

    private setJsonLDContexts(jsonld: Record<string, unknown>, rdfContext: RDFContext): void {
        jsonld['@context'] = rdfContext.toJsonLD();
    }

    private setJsonLDProperty(
        jsonld: Record<string, unknown>,
        name: string,
        value: unknown,
        fieldDefinition: BootedFieldDefinition | null = null,
    ): boolean {
        if (!isObject(value) || Object.keys(value).length !== 1 || Object.keys(value)[0].startsWith('$'))
            value = this.castJsonLDValue(value, fieldDefinition);

        if (value instanceof EmptyJsonLDValue)
            return false;

        jsonld[name] = value;

        return true;
    }

    private castJsonLDValue(value: unknown, fieldDefinition: BootedFieldDefinition | null = null): unknown {
        switch (fieldDefinition && fieldDefinition.type || null) {
            case FieldType.Key:
                return { '@id': toString(value) };
            case FieldType.Date:
                return {
                    '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
                    '@value': (new Date(value as string)).toISOString(),
                };
            case FieldType.Array: {
                const arrayValue = value as unknown[];
                const itemsFieldDefinition =
                    (fieldDefinition as BootedArrayFieldDefinition).items as BootedFieldDefinition;

                switch (arrayValue.length) {
                    case 0:
                        return new EmptyJsonLDValue();
                    case 1:
                        return this.castJsonLDValue(arrayValue[0], itemsFieldDefinition);
                    default:
                        return arrayValue.map(itemValue => this.castJsonLDValue(itemValue, itemsFieldDefinition));
                }
            }
            // TODO handle nested objects
            default:
                return JSON.parse(JSON.stringify(value));
        }
    }

    private convertAttributeValuesToJsonLD(this: SolidModel, attributes: Attributes, compactIRIs: boolean): JsonLD {
        const rdfContext = new RDFContext(this.static('rdfContexts'), compactIRIs);
        const jsonld: JsonLD = {};

        for (const [field, value] of Object.entries(attributes)) {
            this.setJsonLDField(jsonld, field, value, rdfContext);
        }

        return jsonld;
    }

}
