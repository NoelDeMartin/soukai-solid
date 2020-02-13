import {
    Documents,
    EngineAttributes,
    DocumentNotFound,
    Engine,
    Filters,
    EngineHelper,
} from 'soukai';

import { SolidClient, Fetch, Resource, ResourceProperty } from '@/solid';

export default class SolidEngine implements Engine {

    private helper: EngineHelper;

    private client: SolidClient;

    public constructor(fetch: Fetch) {
        this.helper = new EngineHelper();
        this.client = new SolidClient(fetch);
    }

    public async create(
        collection: string,
        attributes: EngineAttributes,
        id?: string,
    ): Promise<string> {
        const properties = this.convertJsonLDToResourceProperties(attributes);

        const resource = await this.client.createResource(collection, id, properties);

        return resource.url;
    }

    public async readOne(_: string, id: string): Promise<EngineAttributes> {
        const resource = await this.client.getResource(id);

        if (resource === null) {
            throw new DocumentNotFound(id);
        }

        return this.convertResourceToJsonLD(resource);
    }

    public async readMany(collection: string, filters: Filters = {}): Promise<Documents> {
        let resources;

        // TODO improve efficiency by using globbing (if we're getting resources within
        // a collection, it's very likely that they are inside the root)

        if ('$in' in filters) {
            // TODO to improve efficiency by making a batch request
            resources = await Promise.all(
                filters['$in'].map(url => this.client.getResource(url)),
            );
            resources = resources.filter(resource => resource !== null);
        } else {
            const rdfsClasses: string[] = [];

            if ('@type' in filters) {
                const value = filters['@type'];

                if ('$contains' in value) {
                    for (const childValue of value['$contains']) {
                        if ('@id' in childValue) {
                            rdfsClasses.push(childValue['@id']);
                        }
                    }
                } else if (typeof value === 'string') {
                    rdfsClasses.push(value);
                }

                // TODO support $or filter
            }

            // TODO to improve efficiency, use more filters than just types in the request
            // (filters are only applied on the client at the moment)
            resources = await this.client.getResources(collection, rdfsClasses);
        }

        const documentsArray = resources.map(this.convertResourceToJsonLD);
        const documents = {};

        for (const document of documentsArray) {
            documents[document['@id'] as string] = document;
        }

        return this.helper.filterDocuments(documents, filters);
    }

    public async update(
        collection: string,
        id: string,
        updatedAttributes: EngineAttributes,
        removedAttributes: string[],
    ): Promise<void> {
        const updatedProperties = this.convertJsonLDToResourceProperties(updatedAttributes);
        const removedProperties = removedAttributes;

        try {
            await this.client.updateResource(id, updatedProperties, removedProperties);
        } catch (error) {
            // TODO this may fail for reasons other than resource not found
            throw new DocumentNotFound(id);
        }
    }

    public async delete(collection: string, id: string): Promise<void> {
        await this.client.deleteResource(id);
    }

    private convertJsonLDToResourceProperties(attributes: EngineAttributes): ResourceProperty[] {
        const properties: ResourceProperty[] = [];

        for (const field in attributes) {
            const value = attributes[field];

            if (value === null || field === '@id') {
                continue;
            } else if (field === '@type') {
                this.addJsonLDTypeProperty(properties, value);
            } else if (Array.isArray(value)) {
                for (const childValue of value) {
                    this.addJsonLDProperty(properties, field, childValue);
                }
            } else {
                this.addJsonLDProperty(properties, field, value);
            }
        }

        return properties;
    }

    private convertResourceToJsonLD(resource: Resource): EngineAttributes {
        const attributes: EngineAttributes = {};

        for (const property of resource.properties) {
            const value = resource.getPropertyValue(property);

            if (property === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
                if (Array.isArray(value)) {
                    attributes['@type'] = value.map(link => ({ '@id': link }));
                } else {
                    attributes['@type'] = { '@id': value };
                }
                continue;
            }

            switch (resource.getPropertyType(property)) {
                case 'literal':
                    attributes[property] = value;
                    break;
                case 'link':
                    if (Array.isArray(value)) {
                        attributes[property] = value.map(link => ({ '@id': link }));
                    } else {
                        attributes[property] = { '@id': value };
                    }
                    break;
            }
        }

        attributes['@id'] = resource.url;

        return attributes;
    }

    private addJsonLDProperty(properties: ResourceProperty[], field: string, value: any): void {
        if (value === null) {
            return;
        }

        if (value instanceof Date) {
            properties.push(ResourceProperty.literal(field, value));
            return;
        }

        if (
            typeof value === 'object' &&
            '@id' in value &&
            typeof value['@id'] === 'string'
        ) {
            properties.push(ResourceProperty.link(field, value['@id']));
            return;
        }

        if (!Array.isArray(value) && typeof value !== 'object') {
            properties.push(ResourceProperty.literal(field, value));
        }
    }

    private addJsonLDTypeProperty(properties: ResourceProperty[], value: any): void {
        if (Array.isArray(value)) {
            for (const childValue of value) {
                if (
                    childValue !== null &&
                    typeof childValue === 'object' &&
                    '@id' in childValue &&
                    typeof childValue['@id'] === 'string'
                ) {
                    properties.push(ResourceProperty.type(childValue['@id']));
                }
            }
        } else if (
            value !== null &&
            typeof value === 'object' &&
            '@id' in value &&
            typeof value['@id'] === 'string'
        ) {
            properties.push(ResourceProperty.type(value['@id']));
        }
    }

}
