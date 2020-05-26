import {
    Attributes,
    EngineFilters,
    EngineRootFilter,
    EngineUpdates,
    FieldDefinition,
    FieldType,
    HasManyRelation,
    HasOneRelation,
    Model,
    Relation,
} from 'soukai';

import SolidModel, { SolidFieldDefinition, SolidFieldsDefinition } from '@/models/SolidModel';

import RDF, { IRI } from '@/solid/utils/RDF';

class EmptyJsonLDValue {}

class RDFContext {

    private vocabs: {
        name: string;
        propertyPrefix: string;
        iriPrefix: string;
        used: boolean;
    }[];
    public readonly compactIRIs: boolean;

    private declarations: object = {};

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

    public addDeclaration(name: string, value: object): void {
        this.declarations[name] = value;
    }

    public toJsonLD(): object {
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

    public getPrimaryKey: () => any | null;
    public getAttribute: (field: string) => any;
    public getAttributes: (includeUndefined?: boolean) => Attributes;
    public getRelation: (relation: string) => Relation | null;
    public getRelationModels: (relation: string) => null | Model[] | Model;
    protected classDef: typeof SolidModel;
    protected getDefaultRdfContext: () => string;

    protected serializeToJsonLD(includeRelations: boolean = true, rdfContext?: RDFContext): object {
        rdfContext = rdfContext || new RDFContext(this.classDef.rdfContexts);

        const jsonld = { '@context': {}, '@type': null };

        for (const [field, value] of Object.entries(this.getAttributes())) {
            this.setJsonLDField(jsonld, field, value, rdfContext);
        }

        if (includeRelations)
            this.includeRelatedJsonLDInstances(jsonld, rdfContext);

        this.setJsonLDTypes(jsonld, rdfContext);
        this.setJsonLDContexts(jsonld, rdfContext);

        return jsonld;
    }

    protected async convertJsonLDToAttributes(jsonld: object): Promise<Attributes> {
        const document = await RDF.parseJsonLD(jsonld!);
        const fieldsDefinition = this.classDef.fields as SolidFieldsDefinition;
        const attributes: Attributes = {};

        attributes[this.classDef.primaryKey] = jsonld['@id'];

        for (const [fieldName, fieldDefinition] of Object.entries(fieldsDefinition)) {
            if (fieldName === this.classDef.primaryKey)
                continue;

            const [firstValue, ...otherValues] = document.rootResource.getPropertyValues(fieldDefinition.rdfProperty);

            if (typeof firstValue === 'undefined')
                continue;

            attributes[fieldName] = otherValues.length > 0 ? [firstValue, ...otherValues] : firstValue;
        }

        return attributes;
    }

    protected convertEngineFiltersToJsonLD(filters: EngineFilters): EngineFilters {
        const rootFilters: EngineRootFilter = {};
        const expandedTypes = [...this.classDef.rdfsClasses];
        const compactedTypes = this.getCompactedRdfsClasses();

        if (filters.$in) {
            rootFilters.$in = filters.$in;
            delete filters.$in;
        }

        return {
            ...rootFilters,
            '@graph': {
                $contains: {
                    '@type': {
                        $or: [
                            { $contains: compactedTypes },
                            { $contains: expandedTypes },
                            ...(
                                compactedTypes.length === 1
                                    ? [
                                        { $eq: compactedTypes[0] },
                                        { $eq: expandedTypes[0] },
                                    ]
                                    : []
                            ),
                        ],
                    },
                    ...this.convertAttributeValuesToJsonLD(filters),
                }
            },
        } as EngineFilters;
    }

    protected convertEngineUpdatesToJsonLD(updates: EngineUpdates): EngineUpdates {
        return this.convertAttributeValuesToJsonLD(updates);
    }

    protected getCompactedRdfsClasses(): string[] {
        const rdfContext = new RDFContext(this.classDef.rdfContexts);

        return [...this.classDef.rdfsClasses].map(rdfClass => rdfContext.compactIRI(rdfClass));
    }

    private setJsonLDField(jsonld: object, field: string, value: any, rdfContext: RDFContext): void {
        if (field === this.classDef.primaryKey) {
            jsonld['@id'] = value.toString();
            return;
        }

        const fieldDefinition = this.classDef.fields[field] as SolidFieldDefinition;
        const propertyName = fieldDefinition
            ? fieldDefinition.rdfProperty
            : (this.getDefaultRdfContext() + field);

        this.setJsonLDProperty(
            jsonld,
            rdfContext.compactIRIs ? rdfContext.compactIRI(propertyName) : propertyName,
            value,
            fieldDefinition,
        );
    }

    private includeRelatedJsonLDInstances(
        jsonld: object,
        rdfContext: RDFContext,
    ): void {
        const relations = this.classDef.relations.map(name => [name, this.getRelation(name)!]) as [string, Relation][];

        for (const [relationName, relationInstance] of relations) {
            if (
                !relationInstance.loaded || (
                    !(relationInstance instanceof HasManyRelation) &&
                    !(relationInstance instanceof HasOneRelation)
                )
            )
                continue;

            const foreignPropertyName = IRI(
                relationInstance.foreignKeyName,
                (relationInstance.relatedClass as typeof SolidModel).rdfContexts,
            );
            const serializeRelatedModel = model => {
                const jsonld = model.serializeToJsonLD(false, rdfContext);

                delete jsonld['@context'];
                delete jsonld[foreignPropertyName];

                return jsonld;
            };

            jsonld[relationName] = relationInstance instanceof HasManyRelation
                ? relationInstance.related!.map(model => serializeRelatedModel(model))
                : serializeRelatedModel(relationInstance.related);

            rdfContext.addDeclaration(relationName, { '@reverse': foreignPropertyName });
        }
    }

    private setJsonLDTypes(jsonld: object, rdfContext: RDFContext): void {
        const types = [...this.classDef.rdfsClasses]
            .map(rdfsClass => rdfContext.compactIRI(rdfsClass));

        jsonld['@type'] = types.length === 1 ? types[0] : types;
    }

    private setJsonLDContexts(jsonld: object, rdfContext: RDFContext): void {
        jsonld['@context'] = rdfContext.toJsonLD();
    }

    private setJsonLDProperty(
        jsonld: object,
        name: string,
        value: any,
        fieldDefinition: SolidFieldDefinition | null = null,
    ): boolean {
        if (typeof value !== 'object' || Object.keys(value).length !== 1 || Object.keys(value)[0].startsWith('$'))
            value = this.castJsonLDValue(value, fieldDefinition);

        if (value instanceof EmptyJsonLDValue)
            return false;

        jsonld[name] = value;

        return true;
    }

    private castJsonLDValue(value: any, fieldDefinition: FieldDefinition | null = null): any {
        switch (fieldDefinition && fieldDefinition.type || null) {
            case FieldType.Key:
                return { '@id': value.toString() };
            case FieldType.Date:
                return {
                    '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
                    '@value': (new Date(value)).toISOString(),
                };
            case FieldType.Array:
                switch (value.length) {
                    case 0:
                        return new EmptyJsonLDValue();
                    case 1:
                        return this.castJsonLDValue(value[0], fieldDefinition!.items!);
                    default:
                        return value.map(itemValue => this.castJsonLDValue(itemValue, fieldDefinition!.items!));
                }
                break;
            // TODO handle nested objects
            default:
                return JSON.parse(JSON.stringify(value));
        }
    }

    private convertAttributeValuesToJsonLD(attributes: Attributes) {
        const rdfContext = new RDFContext(this.classDef.rdfContexts, false);
        const jsonld = {};

        for (const [field, value] of Object.entries(attributes)) {
            this.setJsonLDField(jsonld, field, value, rdfContext);
        }

        return jsonld;
    }

}
