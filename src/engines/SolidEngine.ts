import { arrayFrom, arrayUnique, isObject, urlParentDirectory, urlRoot } from '@noeldemartin/utils';
import {
    DocumentAlreadyExists,
    DocumentNotFound,
    EngineHelper,
    SoukaiError,
} from 'soukai';
import type {
    Engine,
    EngineAttributeLeafValue,
    EngineAttributeValue,
    EngineDocument,
    EngineDocumentsCollection,
    EngineFilters,
    EngineRootFilter,
    EngineUpdateItemsOperatorData,
    EngineUpdates,
} from 'soukai';

import ChangeUrlOperation from '@/solid/operations/ChangeUrlOperation';
import RDFDocument from '@/solid/RDFDocument';
import RDFResourceProperty, { RDFResourcePropertyType } from '@/solid/RDFResourceProperty';
import RemovePropertyOperation from '@/solid/operations/RemovePropertyOperation';
import SolidClient from '@/solid/SolidClient';
import UpdatePropertyOperation from '@/solid/operations/UpdatePropertyOperation';
import type { Fetch } from '@/solid/SolidClient';
import type { JsonLD } from '@/solid/utils/RDF';
import type { LiteralValue } from '@/solid/RDFResourceProperty';
import type { RDFDocumentMetadata } from '@/solid/RDFDocument';
import type { UpdateOperation } from '@/solid/operations/Operation';

import IRI from '@/solid/utils/IRI';

export interface SolidEngineConfig {
    useGlobbing: boolean;
    globbingBatchSize: number | null;
    concurrentFetchBatchSize: number | null;
}

export interface SolidEngineListener {
    onRDFDocumentLoaded?(url: string, metadata: RDFDocumentMetadata): void;
}

export class SolidEngine implements Engine {

    private config: SolidEngineConfig;
    private helper: EngineHelper;
    private client: SolidClient;
    private listeners: SolidEngineListener[] = [];

    public constructor(fetch: Fetch, config: Partial<SolidEngineConfig> = {}) {
        this.helper = new EngineHelper();
        this.config = {
            useGlobbing: false,
            globbingBatchSize: 5,
            concurrentFetchBatchSize: 10,
            ...config,
        };
        this.client = new SolidClient(fetch);

        this.client.setConfig({
            useGlobbing: this.config.useGlobbing,
            concurrentFetchBatchSize: this.config.concurrentFetchBatchSize,
        });
    }

    public setConfig(config: Partial<SolidEngineConfig>): void {
        Object.assign(this.config, config);
    }

    public getFetch(): Fetch {
        return this.client.getFetch();
    }

    public async create(collection: string, document: EngineDocument, id?: string): Promise<string> {
        this.validateJsonLDGraph(document);

        if (id && await this.client.documentExists(id))
            throw new DocumentAlreadyExists(id);

        const properties = await this.getJsonLDGraphProperties(document);
        const url = await this.client.createDocument(collection, id, properties);

        return url;
    }

    public async readOne(_: string, id: string): Promise<EngineDocument> {
        const rdfDocument = await this.client.getDocument(id);

        if (rdfDocument === null)
            throw new DocumentNotFound(id);

        const document = this.convertToEngineDocument(rdfDocument);

        this.emit('onRDFDocumentLoaded', rdfDocument.url as string, rdfDocument.metadata);

        return document;
    }

    public async readMany(collection: string, filters: EngineFilters = {}): Promise<EngineDocumentsCollection> {
        const documentsArray = await this.getDocumentsForFilters(collection, filters);
        const documents = documentsArray.reduce((documents, document) => {
            documents[document.url as string] = this.convertToEngineDocument(document);

            this.emit('onRDFDocumentLoaded', document.url as string, document.metadata);

            return documents;
        }, {} as EngineDocumentsCollection);

        return this.helper.filterDocuments(documents, filters);
    }

    public async update(collection: string, id: string, updates: EngineUpdates): Promise<void> {
        const operations = await this.extractJsonLDGraphUpdate(updates);

        await this.client.updateDocument(id, operations);
    }

    public async delete(collection: string, id: string): Promise<void> {
        await this.client.deleteDocument(id);
    }

    public addListener(listener: SolidEngineListener): void {
        this.listeners.push(listener);
    }

    public removeListener(listener: SolidEngineListener): void {
        const index = this.listeners.indexOf(listener);

        if (index === -1)
            return;

        this.listeners.splice(index, 1);
    }

    private emit<Event extends keyof SolidEngineListener>(
        event: Event,
        ...params: Parameters<Exclude<SolidEngineListener[Event], undefined>>
    ): void {
        this.listeners.forEach(listener => listener[event]?.call(listener, ...params));
    }

    private async getDocumentsForFilters(collection: string, filters: EngineFilters): Promise<RDFDocument[]> {
        const rdfsClasses = this.extractJsonLDGraphTypes(filters);

        return filters.$in
            ? await this.getDocumentsFromUrls(filters.$in, rdfsClasses)
            : await this.client.getDocuments(collection, rdfsClasses.includes(IRI('ldp:Container')));
    }

    private async getDocumentsFromUrls(urls: string[], rdfsClasses: string[]): Promise<RDFDocument[]> {
        const containerDocumentUrlsMap = urls
            .reduce((containerDocumentUrlsMap, documentUrl) => {
                const containerUrl = urlParentDirectory(documentUrl) ?? urlRoot(documentUrl);

                return {
                    ...containerDocumentUrlsMap,
                    [containerUrl]: [
                        ...(containerDocumentUrlsMap[containerUrl] || []),
                        documentUrl,
                    ],
                };
            }, {} as Record<string, string[]>);

        const containerDocumentPromises = Object.entries(containerDocumentUrlsMap)
            .map(async ([containerUrl, documentUrls]) => {
                if (
                    this.config.useGlobbing &&
                    this.config.globbingBatchSize !== null &&
                    this.config.globbingBatchSize <= documentUrls.length
                )
                    return this.client.getDocuments(containerUrl, rdfsClasses.includes(IRI('ldp:Container')));

                const documentPromises = documentUrls.map(url => this.client.getDocument(url));
                const documents = await Promise.all(documentPromises);

                return documents.filter(document => document != null) as RDFDocument[];
            });

        const containerDocuments = await Promise.all(containerDocumentPromises);

        return containerDocuments.flat();
    }

    private convertToEngineDocument(document: RDFDocument): EngineDocument {
        // TODO use RDF libraries instead of implementing this conversion
        return {
            '@graph': document.resources.map(resource => {
                const attributes: JsonLD = {};

                for (const [name, properties] of Object.entries(resource.propertiesIndex)) {
                    const [firstProperty, ...otherProperties] = properties;

                    let key: string = name;
                    let cast: (value: unknown) => unknown = value => value;

                    switch (firstProperty.type) {
                        case RDFResourcePropertyType.Type:
                            key = '@type';
                            break;
                        case RDFResourcePropertyType.Reference:
                            cast = value => ({ '@id': value });
                            break;
                        case RDFResourcePropertyType.Literal:
                            cast = value => value instanceof Date
                                ? {
                                    '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
                                    '@value': value.toISOString(),
                                }
                                : value;
                            break;
                    }

                    attributes[key] = otherProperties.length === 0
                        ? cast(firstProperty.value)
                        : [firstProperty, ...otherProperties].map(property => cast(property.value));
                }

                if (resource.url)
                    attributes['@id'] = resource.url;

                return attributes as EngineAttributeValue;
            }),
        };
    }

    private validateJsonLDGraph(document: EngineDocument): void {
        if (!Array.isArray(document['@graph']))
            throw new SoukaiError(
                'Invalid JSON-LD graph provided for SolidEngine. ' +
                'Are you using a model that isn\'t a SolidModel?',
            );
    }

    private async extractJsonLDGraphUpdate(updates: EngineUpdates): Promise<UpdateOperation[]> {
        if (!this.isJsonLDGraphUpdate(updates))
            throw new SoukaiError(
                'Invalid JSON-LD graph updates provided for SolidEngine. ' +
                'Are you using a model that isn\'t a SolidModel?',
            );

        const operations: UpdateOperation[] = [];
        const graphUpdates = '$apply' in updates['@graph'] ? updates['@graph'].$apply : [updates['@graph']];

        for (const graphUpdate of graphUpdates) {
            if (graphUpdate.$updateItems)
                operations.push(
                    ...arrayFrom(graphUpdate.$updateItems)
                        .map(update => this.extractJsonLDGraphItemsUpdate(update))
                        .flat(),
                );

            if (graphUpdate.$push) {
                const updateOperations = await this.extractJsonLDGraphItemPush(graphUpdate.$push);

                operations.push(...updateOperations);
            }
        }

        return operations;
    }

    private extractJsonLDGraphItemsUpdate(
        { $where, $update, $unset }: EngineUpdateItemsOperatorData,
    ): UpdateOperation[] {
        // TODO use RDF libraries instead of implementing this conversion
        if (!$where || !('@id' in $where))
            throw new SoukaiError(
                'Invalid JSON-LD graph updates provided for SolidEngine. ' +
                'Are you using a model that isn\'t a SolidModel?',
            );

        if ($unset) {
            const filters = $where['@id'] as EngineRootFilter;
            const ids = filters.$in as string[];

            return ids.map(url => new RemovePropertyOperation(url));
        }

        const resourceUrl = $where['@id'] as string;
        const updates = $update;
        const operations: UpdateOperation[] = [];

        for (const [attribute, value] of Object.entries(updates as Record<string, EngineAttributeLeafValue>)) {
            if (value === null)
                throw new SoukaiError('SolidEngine doesn\'t support setting properties to null, delete');

            if (typeof value === 'object' && '$unset' in value) {
                operations.push(new RemovePropertyOperation(resourceUrl, attribute));
                continue;
            }

            if (attribute === '@id') {
                operations.push(new ChangeUrlOperation(resourceUrl, value as string));
                continue;
            }

            operations.push(
                new UpdatePropertyOperation(this.getUpdatePropertyOperationProperty(resourceUrl, attribute, value)),
            );
        }

        return operations;
    }

    /* eslint-disable max-len */
    private getUpdatePropertyOperationProperty(resourceUrl: string, attribute: string, value: unknown): RDFResourceProperty | RDFResourceProperty[];
    private getUpdatePropertyOperationProperty(resourceUrl: string, attribute: string, value: unknown, allowArrays: true): RDFResourceProperty | RDFResourceProperty[];
    private getUpdatePropertyOperationProperty(resourceUrl: string, attribute: string, value: unknown, allowArrays: false): RDFResourceProperty;
    /* eslint-enable max-len */

    private getUpdatePropertyOperationProperty(
        resourceUrl: string,
        attribute: string,
        value: unknown,
        allowArrays: boolean = true,
    ): RDFResourceProperty | RDFResourceProperty[] {
        if (attribute === '@type')
            return RDFResourceProperty.type(resourceUrl, value as string);

        if (Array.isArray(value))
            return allowArrays
                ? value.map(v => this.getUpdatePropertyOperationProperty(resourceUrl, attribute, v, false))
                : fail('Cannot have nested array values');

        if (isObject(value) && '@id' in value)
            return RDFResourceProperty.reference(resourceUrl, attribute, value['@id'] as string);

        if (isObject(value) && '@type' in value && value['@type'] === 'http://www.w3.org/2001/XMLSchema#dateTime')
            return RDFResourceProperty.literal(resourceUrl, attribute, new Date(value['@value'] as string));

        return RDFResourceProperty.literal(resourceUrl, attribute, value as LiteralValue);
    }

    private async extractJsonLDGraphItemPush(item: EngineDocument): Promise<UpdateOperation[]> {
        const itemProperties = await this.getJsonLDGraphProperties(item);

        return itemProperties.map(property => new UpdatePropertyOperation(property));
    }

    private extractJsonLDGraphTypes(filters: EngineFilters): string[] {
        if (!this.isJsonLDGraphTypesFilter(filters))
            return [];

        const typeFilters = filters['@graph'].$contains['@type'].$or;
        const types = typeFilters.reduce((types, typeFilter) => {
            if ('$contains' in typeFilter)
                types.push(...typeFilter.$contains);

            if ('$eq' in typeFilter)
                types.push(typeFilter.$eq);

            return types;
        }, [] as string[]);

        return arrayUnique(types.filter(type => type.startsWith('http')));
    }

    private async getJsonLDGraphProperties(jsonld: JsonLD): Promise<RDFResourceProperty[]> {
        const document = await RDFDocument.fromJsonLD(jsonld);

        return document.properties;
    }

    private isJsonLDGraphUpdate(updates: Record<string, unknown>): updates is {
        '@graph': {
            $updateItems?: EngineUpdateItemsOperatorData;
            $push?: EngineDocument;
        } | {
            $apply: {
                $updateItems?: EngineUpdateItemsOperatorData;
                $push?: EngineDocument;
            }[];
        };
    } {
        const graphUpdate = updates['@graph'];

        if (!isObject(graphUpdate))
            return false;

        const operations = (graphUpdate.$apply ?? [graphUpdate]) as Record<string, unknown>[];

        return !operations.some(update => {
            const keys = Object.keys(update);

            return keys.length !== 1 || !['$updateItems', '$push'].includes(keys[0]);
        });
    }

    private isJsonLDGraphTypesFilter(filters: Record<string, unknown>): filters is {
        '@graph': {
            $contains: {
                '@type': {
                    $or: (
                        { $contains: string[] } |
                        { $eq: string }
                    )[];
                };
            };
        };
    } {
        const graphFilter = filters['@graph'];

        return isObject(graphFilter)
            && isObject(graphFilter.$contains)
            && isObject(graphFilter.$contains['@type'])
            && Array.isArray(graphFilter.$contains['@type'].$or);
    }

}
