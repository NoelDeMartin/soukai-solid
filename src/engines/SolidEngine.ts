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
import Obj from '@/utils/Obj';
import Url from '@/utils/Url';

import SolidDocumentsCache from './SolidDocumentsCache';

export interface LinkedDataDocument extends EngineAttributes {
    '@id': string;
    '@type': { '@id': string } | { '@id': string }[];
}

export interface SolidDocument extends LinkedDataDocument {
    __embedded: Documents;
}

export interface SolidEngineConfig {
    globbingBatchSize: number | null;
    useCache: boolean;
}

export default class SolidEngine implements Engine {

    public static decantEmbeddedDocuments(document: EngineAttributes): [EngineAttributes, Documents | undefined] {
        const { __embedded: embeddedResources, ...attributes } = document;

        return [attributes, embeddedResources as Documents];
    }

    public readonly cache: SolidDocumentsCache;
    public readonly config: SolidEngineConfig;

    private helper: EngineHelper;
    private client: SolidClient;

    public constructor(fetch: Fetch, config: Partial<SolidEngineConfig> = {}) {
        this.cache = new SolidDocumentsCache();

        this.helper = new EngineHelper();
        this.client = new SolidClient(fetch);
        this.config = {
            globbingBatchSize: 5,
            useCache: false,
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

        if (resource === null)
            throw new DocumentNotFound(id);

        const document = this.convertResourceToDocument(resource);

        if (this.config.useCache)
            this.cache.add(document);

        return document;
    }

    public async readMany(collection: string, filters: Filters = {}): Promise<Documents> {
        const documents = await this.getDocumentsForFilters(collection, filters);

        if (this.config.useCache)
            documents.forEach(document => this.cache.add(document));

        return this.helper.filterDocuments(Obj.createMap(documents, '@id'), filters);
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

            if (this.config.useCache)
                this.cache.forget(id);
        } catch (error) {
            // TODO this may fail for reasons other than resource not found
            throw new DocumentNotFound(id);
        }
    }

    public async delete(collection: string, id: string): Promise<void> {
        await this.client.deleteResource(id);

        if (this.config.useCache)
            this.cache.forget(id);
    }

    private async getDocumentsForFilters(collection: string, filters: Filters): Promise<SolidDocument[]> {
        if (!this.config.useCache || !filters.$in) {
            const resources = await this.getResourcesForFilters(collection, filters);

            return resources.map(this.convertResourceToDocument);
        }

        const cachedDocuments = Arr.clean(filters.$in.map(url => this.cache.get(url)));
        const resources = await this.getResourcesForFilters(collection, {
            ...filters,
            $in: Arr.without(filters.$in, cachedDocuments.map(document => document['@id'])),
        });

        return [
            ...cachedDocuments,
            ...resources.map(this.convertResourceToDocument)
        ];
    }

    private async getResourcesForFilters(collection: string, filters: Filters): Promise<Resource[]> {
        const rdfsClasses = this.getRdfsClassesFilter(filters);

        // TODO use filters for SPARQL when supported
        // See https://github.com/solid/node-solid-server/issues/962

        if (!filters.$in)
            return this.client.getResources(collection, rdfsClasses);

        return this.getResourcesFromUrls(collection, rdfsClasses, filters.$in);
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
                if (this.config.globbingBatchSize !== null && resourceUrls.length >= this.config.globbingBatchSize)
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
            ...resource.toJsonLD() as LinkedDataDocument,
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
