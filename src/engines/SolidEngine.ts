import {
    DocumentAlreadyExists,
    DocumentNotFound,
    Documents,
    Engine,
    EngineAttributes,
    EngineHelper,
    Filters,
} from 'soukai';

import { SolidClient, Fetch, Resource, ResourceProperty } from '@/solid';

import Arr from '@/utils/Arr';
import Url from '@/utils/Url';

interface SolidDocument extends EngineAttributes {
    __embedded: Documents;
}

export interface SolidEngineConfig {
    globbingMinimumBatchSize: number | null;
}

export default class SolidEngine implements Engine {

    public static decantEmbeddedDocuments(document: EngineAttributes): [EngineAttributes, Documents | undefined] {
        const { __embedded: embeddedResources, ...attributes } = document;

        return [attributes, embeddedResources as Documents];
    }

    private helper: EngineHelper;

    private client: SolidClient;

    private config: SolidEngineConfig;

    public constructor(fetch: Fetch, config: Partial<SolidEngineConfig> = {}) {
        this.helper = new EngineHelper();
        this.client = new SolidClient(fetch);
        this.config = {
            globbingMinimumBatchSize: 5,
            ...config,
        };
    }

    public async create(
        collection: string,
        attributes: EngineAttributes,
        id?: string,
    ): Promise<string> {
        const properties = this.convertJsonLDToResourceProperties(attributes);

        if (id && await this.client.resourceExists(id))
            throw new DocumentAlreadyExists(id);

        const resource = await this.client.createResource(collection, id, properties);

        return resource.url;
    }

    public async readOne(_: string, id: string): Promise<EngineAttributes> {
        const resource = await this.client.getResource(id);

        if (resource === null) {
            throw new DocumentNotFound(id);
        }

        return this.convertResourceToDocument(resource);
    }

    public async readMany(collection: string, filters: Filters = {}): Promise<Documents> {
        const resources = await this.getResourcesForFilters(collection, filters);
        const documentsArray = resources.map(this.convertResourceToDocument);
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

    private async getResourcesForFilters(collection: string, filters: Filters): Promise<Resource[]> {
        const rdfsClasses = this.getRdfsClassesFilter(filters);

        // TODO use filters for SPARQL when supported
        // See https://github.com/solid/node-solid-server/issues/962

        if (!('$in' in filters))
            return this.client.getResources(collection, rdfsClasses);

        return this.getResourcesFromUrls(collection, rdfsClasses, filters['$in']);
    }

    private async getResourcesFromUrls(collection: string, rdfsClasses: string[], urls: string[]): Promise<Resource[]> {
        const containerResourceUrlsMap = urls
            .reduce((resourcesByContainerUrl, resourceUrl) => {
                const containerUrl = Url.parentDirectory(resourceUrl);

                if (!containerUrl.startsWith(collection))
                    return resourcesByContainerUrl;

                return {
                    ...resourcesByContainerUrl,
                    [containerUrl]: [
                        ...(resourcesByContainerUrl[containerUrl] || []),
                        resourceUrl,
                    ],
                };
            }, {} as { [containerUrl: string]: string[] });

        const containerResourcesPromises = Object.entries(containerResourceUrlsMap)
            .map(async ([containerUrl, resourceUrls]) => {
                if (this.config.globbingMinimumBatchSize !== null && resourceUrls.length > this.config.globbingMinimumBatchSize)
                    return this.client.getResources(containerUrl, rdfsClasses);

                const resourcePromises = resourceUrls.map(url => this.client.getResource(url));
                const resources = await Promise.all(resourcePromises);

                return resources.filter(resource => resource != null) as Resource[];
            });

        const containersResources = await Promise.all(containerResourcesPromises);

        return Arr.flatten(containersResources);
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

    private convertResourceToDocument(resource: Resource): SolidDocument {
        const source = resource.getSource();
        const subjectNodes = source.each(null as any, null as any, null as any, null as any);

        return {
            ...resource.toJsonLD() as EngineAttributes,
            __embedded: Arr.unique(subjectNodes.map(node => node.value))
                .filter(url => url.startsWith(resource.url) && url !== resource.url)
                .map(url => new Resource(url, source))
                .reduce((documents, resource) => ({
                    ...documents,
                    [resource.url]: resource.toJsonLD(),
                }), {}),
        };
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

    private getRdfsClassesFilter(filters: Filters): string[] {
        if (!('@type' in filters))
            return [];

        const value = filters['@type'];

        if (typeof value === 'string')
            return [value];

        if ('$contains' in value)
            return (value['$contains'] as any[])
                .map(value => '@id' in value && value['@id'])
                .filter(rdfsClass => !!rdfsClass);

        // TODO support $or filter

        return [];
    }

}
