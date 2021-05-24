import { isObject, tap, toString } from '@noeldemartin/utils';
import { FieldType } from 'soukai';
import type { Attributes, BootedArrayFieldDefinition, BootedFieldDefinition } from 'soukai';

import type { JsonLD } from '@/solid/utils/RDF';

import SolidHasManyRelation from '../relations/SolidHasManyRelation';
import SolidHasOneRelation from '../relations/SolidHasOneRelation';
import type { SolidModel } from '../SolidModel';

class EmptyJsonLDValue {}

interface JsonLDContextTerm {
    name: string;
    compactingPrefix: string;
    value: string;
    used: boolean;
}

enum IRIFormat {
    Compacted = 'compacted',
    Expanded = 'expanded',
}

class JsonLDContext {

    public static fromRdfClasses(rdfContexts: Record<string, string>): JsonLDContext {
        const terms = Object.entries(rdfContexts).map(([name, value]) => ({
            name,
            value,
            compactingPrefix: `${name}:`,
            used: false,
        }));

        terms.unshift({
            name: '@vocab',
            compactingPrefix: '',
            value: terms[0].value,
            used: false,
        });

        return new JsonLDContext(terms);
    }

    private terms: JsonLDContextTerm[];
    private reverseProperties: Map<string, string>;

    private constructor(terms: JsonLDContextTerm[]) {
        this.terms = terms;
        this.reverseProperties = new Map;
    }

    public addReverseProperty(alias: string, value: string): void {
        this.reverseProperties.set(alias, value);
    }

    public addTerms(rdfContexts: Record<string, string>): void {
        for (const [name, value] of Object.entries(rdfContexts)) {
            if (this.terms.some(term => term.value === value))
                continue;

            let termName = name;
            let counter = 1;
            while (this.terms.some(term => term.name === termName))
                termName = `${name}${++counter}`;

            this.terms.push({
                name,
                value,
                compactingPrefix: `${name}`,
                used: false,
            });
        }
    }

    public getTermForExpandedIRI(expandedIRI: string): JsonLDContextTerm | null {
        return this.terms.find(term => expandedIRI.startsWith(term.value)) ?? null;
    }

    public render(): Record<string, unknown> {
        const rendered = this.terms.reduce((rendered, term) => {
            if (term.used)
                rendered[term.name] = term.value;

            return rendered;
        }, {} as Record<string, unknown>);

        this.reverseProperties.forEach((reversePropertyValue, reversePropertyAlias) => {
            rendered[reversePropertyAlias] = { '@reverse': reversePropertyValue };
        });

        return rendered;
    }

}

export default class JsonLDModelSerializer {

    public static forModel(model: SolidModel, compactsIRIs: boolean = true): JsonLDModelSerializer {
        const context = JsonLDContext.fromRdfClasses(model.static('rdfContexts'));

        return new JsonLDModelSerializer(context, compactsIRIs ? IRIFormat.Compacted : IRIFormat.Expanded);
    }

    private context: JsonLDContext;
    private iriFormat: IRIFormat;

    private constructor(context: JsonLDContext, iriFormat: IRIFormat) {
        this.context = context;
        this.iriFormat = iriFormat;
    }

    public serialize(
        model: SolidModel,
        options: Partial<{
            includeRelations: boolean;
            includeContext: boolean;
            includeTypes: boolean;
            attributes: Attributes;
        }> = {},
    ): JsonLD {
        const jsonld: JsonLD = { '@context': {}, '@type': null };

        for (const [field, value] of Object.entries(options.attributes ?? model.getAttributes()))
            this.setJsonLDField(jsonld, model, field, value);

        if (options.includeRelations ?? true)
            this.setJsonLDRelations(jsonld, model);

        if (options.includeTypes ?? true)
            this.setJsonLDTypes(jsonld, model);
        else
            delete jsonld['@type'];

        if (options.includeContext ?? true)
            this.setJsonLDContext(jsonld);
        else
            delete jsonld['@context'];

        return jsonld;
    }

    public processExpandedIRI(expandedIRI: string): string {
        return this.iriFormat === IRIFormat.Expanded
            ? expandedIRI
            : this.compactExpandedIRI(expandedIRI);
    }

    private compactExpandedIRI(expandedIRI: string): string {
        const term = this.context.getTermForExpandedIRI(expandedIRI);

        return term
            ? tap(term.compactingPrefix + expandedIRI.substr(term.value.length), () => term.used = true)
            : expandedIRI;
    }

    private setJsonLDField(jsonld: JsonLD, model: SolidModel, field: string, value: unknown): void {
        if (field === model.static('primaryKey')) {
            jsonld['@id'] = toString(value);

            return;
        }

        const property = model.getFieldRdfProperty(field);

        if (!property)
            return;

        this.setJsonLDProperty(jsonld, model, this.processExpandedIRI(property), field, value);
    }

    private setJsonLDRelations(jsonld: JsonLD, model: SolidModel): void {
        for (const relationName of model.static('relations')) {
            const relation = model.requireRelation(relationName);

            if (
                !relation.loaded || relation.isEmpty() || (
                    !(relation instanceof SolidHasManyRelation) &&
                    !(relation instanceof SolidHasOneRelation)
                )
            )
                continue;

            this.context.addTerms(relation.relatedClass.rdfsClasses);
            this.setJsonLDRelation(jsonld, relation);
        }
    }

    private setJsonLDRelation(jsonld: JsonLD, relation: SolidHasManyRelation | SolidHasOneRelation): void {
        const relatedInstance = relation.relatedClass.instance() as SolidModel;
        const expandedForeignProperty = relatedInstance.getFieldRdfProperty(relation.foreignKeyName);
        const foreignProperty = this.processExpandedIRI(expandedForeignProperty as string);
        const serializeRelatedModel = (model: SolidModel) =>
            tap(this.serialize(model, { includeRelations: false, includeContext: false }), jsonld => {
                delete jsonld[foreignProperty];
            });

        this.context.addReverseProperty(relation.name, foreignProperty);

        jsonld[relation.name] = relation instanceof SolidHasManyRelation
            ? relation.getLoadedModels().map(model => serializeRelatedModel(model))
            : serializeRelatedModel(relation.related as SolidModel);
    }

    private setJsonLDTypes(jsonld: JsonLD, model: SolidModel): void {
        const types = model.static('rdfsClasses').map(rdfsClass => this.processExpandedIRI(rdfsClass));

        jsonld['@type'] = types.length === 1 ? types[0] : types;
    }

    private setJsonLDContext(jsonld: JsonLD): void {
        jsonld['@context'] = this.context.render();
    }

    private setJsonLDProperty(jsonld: JsonLD, model: SolidModel, name: string, field: string, value: unknown): void {
        if (!isObject(value) || Object.keys(value).length !== 1 || Object.keys(value)[0].startsWith('$'))
            value = this.castJsonLDValue(value, model.static('fields')[field]);

        if (value instanceof EmptyJsonLDValue)
            return;

        jsonld[name] = value;
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

}