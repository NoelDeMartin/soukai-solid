import {
    DocumentAlreadyExists,
    DocumentNotFound,
    Engine,
    EngineAttributeLeafValue,
    EngineDocument,
    EngineDocumentsCollection,
    EngineFilters,
    EngineHelper,
    EngineUpdateItemsOperatorData,
    EngineUpdates,
    SoukaiError,
} from 'soukai';

import RDF, { IRI } from '@/solid/utils/RDF';
import RDFDocument, { RDFDocumentMetadata } from '@/solid/RDFDocument';
import RDFResourceProperty, { RDFResourcePropertyType } from '@/solid/RDFResourceProperty';
import SolidClient, { Fetch } from '@/solid/SolidClient';
import UpdateOperation from '@/solid/operations/Operation';
import RemovePropertyOperation from '@/solid/operations/RemovePropertyOperation';
import UpdatePropertyOperation from '@/solid/operations/UpdatePropertyOperation';

import Arr from '@/utils/Arr';
import Url from '@/utils/Url';

export interface SolidEngineConfig {
    globbingBatchSize: number | null;
}

export interface SolidEngineListener {
    onRDFDocumentLoaded?(url: string, metadata: RDFDocumentMetadata): void;
}

export default class SolidEngine implements Engine {

    private config: SolidEngineConfig;
    private helper: EngineHelper;
    private client: SolidClient;
    private listeners: SolidEngineListener[] = [];

    public constructor(fetch: Fetch, config: Partial<SolidEngineConfig> = {}) {
        this.helper = new EngineHelper();
        this.client = new SolidClient(fetch);
        this.config = {
            globbingBatchSize: 5,
            ...config,
        };
    }

    public async create(collection: string, document: EngineDocument, id?: string): Promise<string> {
        this.validateJsonLDGraph(document);

        if (id && await this.client.documentExists(id))
            throw new DocumentAlreadyExists(id);

        const properties = await this.getJsonLDGraphProperties(document);
        const { url } = await this.client.createDocument(collection, id, properties);

        return url!;
    }

    public async readOne(_: string, id: string): Promise<EngineDocument> {
        const rdfDocument = await this.client.getDocument(id);

        if (rdfDocument === null)
            throw new DocumentNotFound(id);

        const document = this.convertToEngineDocument(rdfDocument);

        this.emit('onRDFDocumentLoaded', rdfDocument.url, rdfDocument.metadata);

        return document;
    }

    public async readMany(collection: string, filters: EngineFilters = {}): Promise<EngineDocumentsCollection> {
        const documentsArray = await this.getDocumentsForFilters(collection, filters);
        const documents = documentsArray.reduce((documents, document) => {
            documents[document.url] = this.convertToEngineDocument(document);

            this.emit('onRDFDocumentLoaded', document.url, document.metadata);

            return documents;
        }, {});

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

    private emit<Event extends keyof SolidEngineListener>(event: Event, ...params: Parameters<Exclude<SolidEngineListener[Event], undefined>>): void {
        this.listeners.forEach(listener => listener[event]?.call(listener, ...params));
    }

    private async getDocumentsForFilters(collection: string, filters: EngineFilters): Promise<RDFDocument[]> {
        const rdfsClasses = this.extractJsonLDGraphTypes(filters);

        // TODO use filters for SPARQL when supported
        // See https://github.com/solid/node-solid-server/issues/962
        return filters.$in
            ? await this.getDocumentsFromUrls(filters.$in, rdfsClasses)
            : await this.getContainerDocuments(collection, rdfsClasses);
    }

    private async getDocumentsFromUrls(urls: string[], rdfsClasses: string[]): Promise<RDFDocument[]> {
        const containerDocumentUrlsMap = urls
            .reduce((containerDocumentUrlsMap, documentUrl) => {
                const containerUrl = Url.parentDirectory(documentUrl);

                return {
                    ...containerDocumentUrlsMap,
                    [containerUrl]: [
                        ...(containerDocumentUrlsMap[containerUrl] || []),
                        documentUrl,
                    ],
                };
            }, {} as MapObject<string[]>);

        const containerDocumentPromises = Object.entries(containerDocumentUrlsMap)
            .map(async ([containerUrl, documentUrls]) => {
                if (this.config.globbingBatchSize !== null && documentUrls.length >= this.config.globbingBatchSize)
                    return this.getContainerDocuments(containerUrl, rdfsClasses);

                const documentPromises = documentUrls.map(url => this.client.getDocument(url));
                const documents = await Promise.all(documentPromises);

                return documents.filter(document => document != null) as RDFDocument[];
            });

        const containerDocuments = await Promise.all(containerDocumentPromises);

        return Arr.flatten(containerDocuments);
    }

    private async getContainerDocuments(containerUrl: string, types: string[]): Promise<RDFDocument[]> {
        const documents = await this.client.getDocuments(
            containerUrl,
            types.indexOf(IRI('ldp:Container')) !== -1,
        );

        return documents;
    }

    private convertToEngineDocument(document: RDFDocument): EngineDocument {
        // TODO use RDF libraries instead of implementing this conversion
        return {
            '@graph': document.resources.map(resource => {
                const attributes: any = {};

                for (const [name, properties] of Object.entries(resource.propertiesIndex)) {
                    const [firstProperty, ...otherProperties] = properties;

                    let key: string = name;
                    let cast: (value: any) => any = value => value;

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
                                : value
                            break;
                    }

                    attributes[key] = otherProperties.length === 0
                        ? cast(firstProperty.value)
                        : [firstProperty, ...otherProperties].map(property => cast(property.value));
                }

                attributes['@id'] = resource.url;

                return attributes;
            }),
        };
    }

    private validateJsonLDGraph(document: EngineDocument): void {
        if (!Array.isArray(document['@graph']))
            throw new SoukaiError(
                'Invalid JSON-LD graph provided for SolidEngine. ' +
                "Are you using a model that isn't a SolidModel?",
            );
    }

    private async extractJsonLDGraphUpdate(updates: EngineUpdates): Promise<UpdateOperation[]> {
        if (!this.isJsonLDGraphUpdate(updates))
            throw new SoukaiError(
                'Invalid JSON-LD graph updates provided for SolidEngine. ' +
                "Are you using a model that isn't a SolidModel?",
            );

        const operations: UpdateOperation[] = [];

        if (updates['@graph'].$updateItems)
            operations.push(...this.extractJsonLDGraphItemsUpdate(updates['@graph'].$updateItems));

        if (updates['@graph'].$push) {
            const updateOperations = await this.extractJsonLDGraphItemPush(updates['@graph'].$push);

            operations.push(...updateOperations);
        }

        return operations;
    }

    private extractJsonLDGraphItemsUpdate({ $where, $update, $unset }: EngineUpdateItemsOperatorData): UpdateOperation[] {
        if (!$where || !('@id' in $where))
            throw new SoukaiError(
                'Invalid JSON-LD graph updates provided for SolidEngine. ' +
                "Are you using a model that isn't a SolidModel?",
            );

        if ($unset) {
            return $where['@id']!['$in'].map(url => new RemovePropertyOperation(url));
        }

        const resourceUrl = $where['@id'] as string;
        const updates = $update;
        const operations: UpdateOperation[] = [];

        for (const [attribute, value] of Object.entries(updates as MapObject<EngineAttributeLeafValue>)) {
            if (value === null) {
                throw new SoukaiError("SolidEngine doesn't support setting properties to null, delete");
            }

            if (typeof value === 'object' && '$unset' in value) {
                operations.push(new RemovePropertyOperation(resourceUrl, attribute));
                continue;
            }

            operations.push(new UpdatePropertyOperation(RDFResourceProperty.literal(resourceUrl, attribute, value)));
        }

        return operations;
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

        return Arr.unique(types.filter(type => type.startsWith('http')));
    }

    private async getJsonLDGraphProperties(jsonld: object): Promise<RDFResourceProperty[]> {
        const document = await RDF.parseJsonLD(jsonld);

        return document.properties;
    }

    private isJsonLDGraphUpdate(updates: any): updates is {
        '@graph': {
            $updateItems?: EngineUpdateItemsOperatorData;
            $push?: EngineDocument;
        };
    } {
        return typeof updates['@graph'] === 'object'
            && (
                typeof updates['@graph'].$updateItems === 'object' ||
                typeof updates['@graph'].$push === 'object'
            );
    }

    private isJsonLDGraphTypesFilter(filters: any): filters is {
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
        return typeof filters['@graph'] === 'object'
            && typeof filters['@graph'].$contains === 'object'
            && typeof filters['@graph'].$contains['@type'] === 'object'
            && Array.isArray(filters['@graph'].$contains['@type'].$or);
    }

}
