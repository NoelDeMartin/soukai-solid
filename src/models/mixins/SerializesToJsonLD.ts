import { ModelKey } from 'soukai';
import type { Attributes, EngineAttributeFilter, EngineFilters, EngineUpdates } from 'soukai';

import type { SolidModel } from '@/models/SolidModel';

import { RDFResourcePropertyType } from '@/solid/RDFResourceProperty';
import RDFDocument from '@/solid/RDFDocument';
import type { JsonLD, JsonLDResource } from '@/solid/utils/RDF';

import JsonLDModelSerializer from '../utils/JsonLDModelSerializer';

export default class SerializesToJsonLD {

    protected serializeToJsonLD(this: SolidModel, includeRelations: boolean = true): JsonLD {
        return JsonLDModelSerializer.forModel(this).serialize(this, { includeRelations });
    }

    protected async convertJsonLDToAttributes(this: SolidModel, jsonld: JsonLDResource): Promise<Attributes> {
        // TODO this is probably wasteful because we've already parsed this in createManyFromEngineDocuments method
        const document = await RDFDocument.fromJsonLD(jsonld);
        const resource = document.requireResource(jsonld['@id']);
        const fieldsDefinition = this.static('fields');
        const attributes: Attributes = {};

        attributes[this.static('primaryKey')] = jsonld['@id'];

        for (const [fieldName, fieldDefinition] of Object.entries(fieldsDefinition)) {
            if (!fieldDefinition.rdfProperty)
                continue;

            const properties = resource.propertiesIndex[fieldDefinition.rdfProperty] || [];
            const propertyValues = properties.map(
                property =>
                    property.type === RDFResourcePropertyType.Reference
                        ? new ModelKey(property.value)
                        : property.value,
            );
            const [firstValue, ...otherValues] = propertyValues;

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
        const serializer = JsonLDModelSerializer.forModel(this);
        const expandedTypes = this.static('rdfsClasses');
        const compactedTypes = expandedTypes.map(rdfClass => serializer.processExpandedIRI(rdfClass));
        const typeFilters: EngineAttributeFilter[] = [];

        // TODO this should probably be refactored, because it doesn't make sense that
        // types are both expanded and compacted but filters aren't.
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

    private convertAttributeValuesToJsonLD(this: SolidModel, attributes: Attributes, compactIRIs: boolean): JsonLD {
        const serializer = JsonLDModelSerializer.forModel(this, compactIRIs);

        return serializer.serialize(this, {
            includeContext: false,
            includeTypes: false,
            includeRelations: false,
            attributes,
        });
    }

}
