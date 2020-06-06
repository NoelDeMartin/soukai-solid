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
import RDFDocument from '@/solid/RDFDocument';
import RDFResourceProperty, { RDFResourcePropertyType } from '@/solid/RDFResourceProperty';
import SolidClient, { Fetch } from '@/solid/SolidClient';

import Arr from '@/utils/Arr';
import Url from '@/utils/Url';

export interface SolidEngineConfig {
    globbingBatchSize: number | null;
}

export default class SolidEngine implements Engine {

    private config: SolidEngineConfig;
    private helper: EngineHelper;
    private client: SolidClient;

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

        return document;
    }

    public async readMany(collection: string, filters: EngineFilters = {}): Promise<EngineDocumentsCollection> {
        const documents = await this.getDocumentsForFilters(collection, filters);

        return this.helper.filterDocuments(documents, filters);
    }

    public async update(collection: string, id: string, updates: EngineUpdates): Promise<void> {
        const [updatedProperties, removedProperties] = await this.extractJsonLDGraphUpdate(updates);

        try {
            await this.client.updateDocument(id, updatedProperties, removedProperties);
        } catch (error) {
            // TODO this may fail for reasons other than document not found
            throw new DocumentNotFound(id);
        }
    }

    public async delete(collection: string, id: string): Promise<void> {
        await this.client.deleteDocument(id);
    }

    private async getDocumentsForFilters(collection: string, filters: EngineFilters): Promise<EngineDocumentsCollection> {
        const rdfsClasses = this.extractJsonLDGraphTypes(filters);

        // TODO use filters for SPARQL when supported
        // See https://github.com/solid/node-solid-server/issues/962
        const documentsArray = filters.$in
            ? await this.getDocumentsFromUrls(rdfsClasses, filters.$in)
            : await this.getContainerDocuments(collection, rdfsClasses);

        return documentsArray.reduce((documents, document) => {
            documents[document.url] = this.convertToEngineDocument(document);

            return documents;
        }, {});
    }

    private async getDocumentsFromUrls(rdfsClasses: string[], urls: string[]): Promise<RDFDocument[]> {
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

        return documents.filter(document => {
            for (const type of types) {
                if (!document.rootResource.isType(type))
                    return false;
            }

            return true;
        });
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

    private async extractJsonLDGraphUpdate(updates: EngineUpdates): Promise<[RDFResourceProperty[], [string, string][]]> {
        if (!this.isJsonLDGraphUpdate(updates)) {
            console.log('bad updates', updates);

            throw new SoukaiError(
                'Invalid JSON-LD graph updates provided for SolidEngine. ' +
                "Are you using a model that isn't a SolidModel?",
            );
        }

        const updatedProperties: RDFResourceProperty[] = [];
        const removedProperties: [string, string][] = [];

        if (updates['@graph'].$updateItems)
            this.extractJsonLDGraphItemsUpdate(
                updatedProperties,
                removedProperties,
                updates['@graph'].$updateItems,
            );

        if (updates['@graph'].$push)
            await this.extractJsonLDGraphItemPush(
                updatedProperties,
                updates['@graph'].$push,
            );

        return [updatedProperties, removedProperties];
    }

    private extractJsonLDGraphItemsUpdate(
        updatedProperties: RDFResourceProperty[],
        removedProperties: [string, string][],
        itemUpdates: EngineUpdateItemsOperatorData[],
    ): void {
        for (const { $where, $update } of itemUpdates) {
            if (!$where || !('@id' in $where))
                throw new SoukaiError(
                    'Invalid JSON-LD graph updates provided for SolidEngine. ' +
                    "Are you using a model that isn't a SolidModel?",
                );

            const resourceUrl = $where!['@id'] as string;
            const updates = $update;

            for (const [attribute, value] of Object.entries(updates as MapObject<EngineAttributeLeafValue>)) {
                if (value === null) {
                    throw new SoukaiError("SolidEngine doesn't support setting properties to null, delete");
                }

                if (typeof value === 'object' && '$unset' in value) {
                    removedProperties.push([resourceUrl, attribute]);
                    continue;
                }

                updatedProperties.push(RDFResourceProperty.literal(resourceUrl, attribute, value));
            }
        }
    }

    private async extractJsonLDGraphItemPush(
        updatedProperties: RDFResourceProperty[],
        item: EngineDocument,
    ): Promise<void> {
        const itemProperties = await this.getJsonLDGraphProperties(item);

        updatedProperties.push(...itemProperties);
    }

    private extractJsonLDGraphTypes(filters: EngineFilters): string[] {
        if (!this.isJsonLDGraphFilter(filters))
            throw new SoukaiError(
                'Invalid JSON-LD graph filters provided for SolidEngine. ' +
                "Are you using a model that isn't a SolidModel?",
            );

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
            $updateItems?: EngineUpdateItemsOperatorData[];
            $push?: EngineDocument;
        };
    } {
        return typeof updates['@graph'] === 'object'
            && (
                Array.isArray(updates['@graph'].$updateItems) ||
                typeof updates['@graph'].$push === 'object'
            );
    }

    private isJsonLDGraphFilter(filters: any): filters is {
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
