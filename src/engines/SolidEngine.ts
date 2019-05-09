import {
    Documents,
    EngineAttributes,
    DocumentNotFound,
    Engine,
    Filters,
    EngineHelper,
} from 'soukai';

import Solid, { Resource, ResourceProperty } from '@/solid';
import UUID from '@/utils/UUID';

export default class SolidEngine implements Engine {

    private helper: EngineHelper;

    public constructor() {
        this.helper = new EngineHelper();
    }

    public async create(
        collection: string,
        attributes: EngineAttributes,
        id?: string,
    ): Promise<string> {
        const properties = this.convertJsonLDToResourceProperties(attributes);
        const url = id || collection + UUID.generate();

        if (this.hasContainerType(properties)) {
            await Solid.createContainer(url, properties);
        } else {
            await Solid.createResource(url, properties);
        }

        return url;
    }

    public async readOne(_: string, id: string): Promise<EngineAttributes> {
        const resource = await Solid.getResource(id);

        if (resource === null) {
            throw new DocumentNotFound(id);
        }

        return this.convertResourceToJsonLD(resource);
    }

    public async readMany(collection: string, filters: Filters = {}): Promise<Documents> {
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
        }

        const resources = await Solid.getResources(collection, rdfsClasses);

        const documentsArray = resources.map(this.convertResourceToJsonLD);
        const documents = {};

        for (const document of documentsArray) {
            documents[document['@id'] as string] = document;
        }

        return this.helper.filterDocuments(documents);
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
            await Solid.updateResource(id, updatedProperties, removedProperties);
        } catch (error) {
            // TODO this may fail for reasons other than resource not found
            throw new DocumentNotFound(id);
        }
    }

    public async delete(collection: string, id: string): Promise<void> {
        // TODO
    }

    private convertJsonLDToResourceProperties(attributes: EngineAttributes): ResourceProperty[] {
        const properties: ResourceProperty[] = [];

        for (const field in attributes) {
            const value = attributes[field];

            if (value === null) {
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

    private hasContainerType(properties: ResourceProperty[]): boolean {
        for (const property of properties) {
            if (property.isType('http://www.w3.org/ns/ldp#Container')) {
                return true;
            }
        }

        return false;
    }

    private addJsonLDProperty(properties: ResourceProperty[], field: string, value: any): void {
        if (value === null) {
            return;
        }

        if (
            typeof value === 'object' &&
            '@id' in value &&
            typeof value['@id'] === 'string'
        ) {
            properties.push(ResourceProperty.type(value['@id']));
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
