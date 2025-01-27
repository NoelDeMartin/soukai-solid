import { DocumentNotFound, SoukaiError } from 'soukai';
import {
    arrayDiff,
    arrayFilter,
    arrayRemove,
    isEmpty,
    requireUrlDirectoryName,
    requireUrlParentDirectory,
    urlClean,
    urlFileName,
    urlResolve,
} from '@noeldemartin/utils';
import type { JsonLD } from '@noeldemartin/solid-utils';
import {
    NetworkRequestError,
    UnsuccessfulNetworkRequestError,
    quadsToJsonLD,
    turtleToQuads,
} from '@noeldemartin/solid-utils';
import type { Quad, Quad_Object } from 'rdf-js';

import IRI from '@/solid/utils/IRI';
import RDFDocument from '@/solid/RDFDocument';
import RDFResourceProperty, { RDFResourcePropertyType } from '@/solid/RDFResourceProperty';
import RemovePropertyOperation from '@/solid/operations/RemovePropertyOperation';
import UpdatePropertyOperation from '@/solid/operations/UpdatePropertyOperation';
import { decantUpdateOperations, decantUpdateOperationsData } from '@/solid/operations/utils';
import { OperationType } from '@/solid/operations/Operation';
import type { LiteralValue } from '@/solid/RDFResourceProperty';
import type { UpdateOperation } from '@/solid/operations/Operation';

const RESERVED_CONTAINER_PROPERTIES = [
    IRI('ldp:contains'),
    IRI('posix:mtime'),
    IRI('posix:size'),
    IRI('purl:modified'),
];

const RESERVED_CONTAINER_TYPES = [
    IRI('ldp:Container'),
    IRI('ldp:BasicContainer'),
];

// TODO extract file to @noeldemartin/solid-utils

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export declare type AnyFetch = (input: any, options?: any) => Promise<any>;
export declare type TypedFetch = (input: RequestInfo, options?: RequestInit) => Promise<Response>;
export declare type Fetch = TypedFetch | AnyFetch;

export type SolidClientConfig = {
    useGlobbing: boolean;
    concurrentFetchBatchSize: number | null;
};

export interface QueryOptions {
    format?: string;
    method?: string;
}

export default class SolidClient {

    private fetch: TypedFetch;
    private config: SolidClientConfig;

    constructor(defaultFetch?: Fetch) {
        const fetch = defaultFetch ?? window?.fetch ?? global?.fetch;

        this.fetch = async (input, options) => {
            try {
                const response = await fetch(input, options);

                return response;
            } catch (error) {
                const url = typeof input === 'object' ? input.url : input;

                throw new NetworkRequestError(url, { cause: error });
            }
        };
        this.config = {
            useGlobbing: false,
            concurrentFetchBatchSize: 5,
        };
    }

    public getFetch(): Fetch {
        return this.fetch;
    }

    public setConfig(config: Partial<SolidClientConfig>): void {
        Object.assign(this.config, config);
    }

    public async createDocument(
        parentUrl: string,
        url: string | null = null,
        properties: RDFResourceProperty[] = [],
        options: QueryOptions = {},
    ): Promise<string> {
        const ldpContainer = IRI('ldp:Container');
        const isContainer = () => properties.some(
            property =>
                property.resourceUrl === url &&
                property.type === RDFResourcePropertyType.Type &&
                property.value === ldpContainer,
        );

        // TODO some of these operations can overwrite an existing document.
        // In this project that's ok because the existence of the document is checked
        // in the engine before calling this method, but it should be fixed for correctness.
        return url && isContainer()
            ? this.createContainerDocument(parentUrl, url, properties)
            : this.createNonContainerDocument(parentUrl, url, properties, options);
    }

    public async getDocument(url: string): Promise<RDFDocument | null> {
        const response = await this.fetch(url, {
            headers: { Accept: 'text/turtle' },
        });

        if (response.status !== 200)
            return null;

        const data = await response.text();
        const document = await RDFDocument.fromTurtle(data, {
            headers: response.headers,
            baseIRI: url,
        });

        return document;
    }

    public async getDocuments(containerUrl: string, needsContainers: boolean = false): Promise<RDFDocument[]> {
        try {
            return (this.config.useGlobbing && !needsContainers)
                ? await this.getContainerDocumentsUsingGlobbing(containerUrl)
                : await this.getContainerDocuments(containerUrl);
        } catch (error) {
            if (this.config.useGlobbing) {
                // Due to an existing bug, empty containers return 404
                // see: https://github.com/solid/node-solid-server/issues/900
                // eslint-disable-next-line no-console
                console.error(error);

                return [];
            }

            throw error;
        }
    }

    public async updateDocument(
        url: string,
        operations: UpdateOperation[],
        options: QueryOptions = {},
    ): Promise<void> {
        if (operations.length === 0) {
            return;
        }

        const document = await this.getDocument(url);

        if (document === null)
            throw new DocumentNotFound(url);

        this.processChangeUrlOperations(document, operations);
        this.processUpdatePropertyOperations(document, operations);

        document.resource(url)?.isType(IRI('ldp:Container'))
            ? await this.updateContainerDocument(document, operations)
            : await this.updateNonContainerDocument(document, operations, options);
    }

    public async overwriteDocument(url: string, properties: RDFResourceProperty[]): Promise<void> {
        const document = await this.getDocument(url);

        if (document === null)
            throw new DocumentNotFound(url);

        const response = await this.fetch(url, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/sparql-update',
            },
            body: `
                DELETE DATA { ${RDFResourceProperty.toTurtle(document.properties, url)} } ;
                INSERT DATA { ${RDFResourceProperty.toTurtle(properties, url)} }
            `,
        });

        this.assertSuccessfulResponse(response, `Error overwriting document at ${document.url}`);
    }

    public async deleteDocument(url: string, preloadedDocument?: RDFDocument): Promise<void> {
        const document = preloadedDocument ?? await this.getDocument(url);

        if (document === null)
            return;

        if (document.resource(url)?.isType(IRI('ldp:Container'))) {
            const documents = this.config.useGlobbing
                ? await this.getContainerDocumentsUsingGlobbing(url)
                : await this.getDocumentsFromContainer(url, document);

            await Promise.all(documents.map(document => this.deleteDocument(document.url as string, document)));
        }

        const response = await this.fetch(url, { method: 'DELETE' });

        this.assertSuccessfulResponse(response, `Error deleting document at ${url}`);
    }

    public async documentExists(url: string): Promise<boolean> {
        const response = await this.fetch(url, {
            headers: { Accept: 'text/turtle' },
        });

        if (response.status === 200) {
            const data = await response.text();

            return data.length > 0;
        } else if (response.status === 404) {
            return false;
        } else {
            throw new SoukaiError(
                `Couldn't determine if document at ${url} exists, got ${response.status} response`,
            );
        }
    }

    private async createContainerDocument(
        parentUrl: string,
        url: string,
        properties: RDFResourceProperty[],
    ): Promise<string> {
        await this.createContainerFolder(parentUrl, url);
        await this.updateContainerMetadata(url, properties);

        return url;
    }

    private async createContainerFolder(parentUrl: string, url: string): Promise<void> {
        if (!url.startsWith(parentUrl))
            throw new SoukaiError('Explicit document url should start with the parent url');

        if (!url.endsWith('/'))
            throw new SoukaiError(`Container urls must end with a trailing slash, given ${url}`);

        const response = await this.fetch(
            url,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'text/turtle',
                    'Link': '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',
                    'If-None-Match': '*',
                },
            },
        );

        if (this.isInternalErrorResponse(response)) {
            // Handle NSS internal error
            // See https://github.com/nodeSolidServer/node-solid-server/issues/1703
            return this.createContainerDocumentUsingPOST(url);
        }

        this.assertSuccessfulResponse(response, `Error creating container folder at ${url}`);
    }

    private async createContainerDocumentUsingPOST(url: string, createParent: boolean = true): Promise<void> {
        const parentUrl = requireUrlParentDirectory(url);
        const response = await this.fetch(
            parentUrl,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/turtle',
                    'Link': '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',
                    'Slug': requireUrlDirectoryName(url),
                    'If-None-Match': '*',
                },
            },
        );

        if (response.status === 404 && createParent) {
            await this.createContainerDocumentUsingPOST(parentUrl);

            return this.createContainerDocumentUsingPOST(url, false);
        }

        this.assertSuccessfulResponse(response, `Error creating container at ${url}`);
    }

    private async updateContainerMetadata(url: string, properties: RDFResourceProperty[]): Promise<void> {
        if (properties.length === 0) {
            return;
        }

        const document = await this.getDocument(url);

        if (!document) {
            throw new SoukaiError(`Could not get document ${url} after creation`);
        }

        const metaUrl = document.metadata.describedBy || `${document.url}.meta`;
        const turtle = RDFResourceProperty.toTurtle(
            this.withoutReservedContainerProperties(url, properties),
            url,
        );
        const response = await this.fetch(metaUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/sparql-update' },
            body: `INSERT DATA { ${turtle} }`,
        });

        this.assertSuccessfulResponse(response, `Error updating container metadata at ${metaUrl}`);
    }

    private async createNonContainerDocument(
        parentUrl: string,
        url: string | null,
        properties: RDFResourceProperty[],
        options: QueryOptions = {},
    ): Promise<string> {
        if (!url || options.method?.toLowerCase() === 'post') {
            const format = options.format ?? 'text/turtle';
            const body = await this.renderProperties(url, properties, format);
            const headers: Record<string, string> = { 'Content-Type': format };

            if (url) {
                headers['Slug'] = urlFileName(url);
            }

            const response = await this.fetch(parentUrl, {
                method: options.method ?? 'POST',
                headers,
                body,
            });

            this.assertSuccessfulResponse(response, `Error creating document under ${parentUrl}`);

            return urlResolve(parentUrl, response.headers.get('Location') || '');
        }

        if (!url.startsWith(parentUrl))
            throw new SoukaiError('A minted document url should start with the parent url');

        const response = await this.fetch(url, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/sparql-update',
                'If-None-Match': '*',
            },
            body: `INSERT DATA { ${RDFResourceProperty.toTurtle(properties, url)} }`,
        });

        this.assertSuccessfulResponse(response, `Error creating document at ${url}`);

        return url;
    }

    private async getContainerDocuments(containerUrl: string): Promise<RDFDocument[]> {
        const response = await this.fetch(containerUrl, { headers: { Accept: 'text/turtle' } });
        const turtleData = await response.text();
        const containerDocument = await RDFDocument.fromTurtle(turtleData, { baseIRI: containerUrl });

        return this.getDocumentsFromContainer(containerUrl, containerDocument);
    }

    private async getDocumentsFromContainer(
        containerUrl: string,
        containerDocument: RDFDocument,
    ): Promise<RDFDocument[]> {
        const documents = [];
        const resourceUrls =
            containerDocument.resource(containerUrl)?.getPropertyValues('ldp:contains') as string[] ??
            [];

        while (resourceUrls.length > 0) {
            const chunkUrls = resourceUrls.splice(0, this.config.concurrentFetchBatchSize || resourceUrls.length);
            const chunkDocuments = await Promise.all(chunkUrls.map(url => this.getDocument(url)));

            documents.push(...chunkDocuments);
        }

        return documents.filter<RDFDocument>((document: RDFDocument | null): document is RDFDocument => !!document);
    }

    private async getContainerDocumentsUsingGlobbing(containerUrl: string): Promise<RDFDocument[]> {
        const response = await this.fetch(containerUrl + '*', { headers: { Accept: 'text/turtle' } });

        this.assertSuccessfulResponse(
            response,
            `Error getting container documents using globbing from ${containerUrl}`,
        );

        const turtleData = await response.text();
        const globbingDocument = await RDFDocument.fromTurtle(turtleData, { baseIRI: containerUrl });
        const statementsByUrl = globbingDocument.statements.reduce(
            (statementsByUrl, statement) => {
                const baseUrl = urlClean(statement.subject.value, { fragment: false });
                const urlStatements = statementsByUrl[baseUrl] = statementsByUrl[baseUrl] ?? [];

                urlStatements.push(statement);

                return statementsByUrl;
            },
            {} as Record<string, Quad[]>,
        );

        return Object.entries(statementsByUrl).map(([url, statements]) => new RDFDocument(url, statements));
    }

    private async updateContainerDocument(document: RDFDocument, operations: UpdateOperation[]): Promise<void> {
        const createRemovePropertyOperation =
            (property: string) => new RemovePropertyOperation(document.url as string, property);
        const createRemoveTypeOperation =
            (type: string) => new RemovePropertyOperation(document.url as string, IRI('rdf:type'), type);

        operations.push(...RESERVED_CONTAINER_PROPERTIES.map(createRemovePropertyOperation));
        operations.push(...RESERVED_CONTAINER_TYPES.map(createRemoveTypeOperation));

        await this.updateNonContainerDocument(
            document.clone({ changeUrl: document.metadata.describedBy || `${document.url}.meta` }),
            operations,
        );
    }

    private async updateNonContainerDocument(
        document: RDFDocument,
        operations: UpdateOperation[],
        options: QueryOptions = {},
    ): Promise<void> {
        const format = options.format ?? 'application/sparql-update';

        switch (format) {
            case 'application/sparql-update':
                return this.updateNonContainerDocumentWithSparql(document, operations);
            case 'application/ld+json':
                return this.updateNonContainerDocumentWithJsonLD(document, operations);
        }

        throw new Error(`Unsupported update format: '${format}'`);
    }

    private async updateNonContainerDocumentWithSparql(
        document: RDFDocument,
        operations: UpdateOperation[],
    ): Promise<void> {
        const [updatedProperties, removedProperties] = decantUpdateOperationsData(operations);
        const inserts = RDFResourceProperty.toTurtle(updatedProperties.flat(), document.url);
        const deletes = RDFResourceProperty.toTurtle(
            document.properties.filter(
                property =>
                    removedProperties.some(([resourceUrl, name, value]) =>
                        resourceUrl === property.resourceUrl &&
                            (!name || name === property.name) &&
                            (!value || value === property.value)),
            ),
            document.url,
        );

        const response = await this.fetch(document.url as string, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/sparql-update' },
            body: arrayFilter([
                deletes.length > 0 && `DELETE DATA { ${deletes} }`,
                inserts.length > 0 && `INSERT DATA { ${inserts} }`,
            ]).join(' ; '),
        });

        this.assertSuccessfulResponse(response, `Error updating document at ${document.url}`);
    }

    private async updateNonContainerDocumentWithJsonLD(
        document: RDFDocument,
        operations: UpdateOperation[],
    ): Promise<void> {
        if (!document.url) {
            throw new Error('Missing document url for JsonLD update');
        }

        const [updatedProperties, removedProperties] = decantUpdateOperationsData(operations);
        const documentProperties = document.properties
            .filter(
                property =>
                    !removedProperties.some(([resourceUrl, name, value]) =>
                        resourceUrl === property.resourceUrl &&
                            (!name || name === property.name) &&
                            (!value || value === property.value)),
            )
            .concat(updatedProperties.flat());

        const response = await this.fetch(document.url, {
            headers: { 'Content-Type': 'application/ld+json' },
            method: 'PUT',
            body: await this.renderProperties(document.url, documentProperties, 'application/ld+json'),
        });

        this.assertSuccessfulResponse(response, `Error updating document at ${document.url}`);
    }

    private withoutReservedContainerProperties(
        resourceUrl: string | null,
        properties: RDFResourceProperty[],
    ): RDFResourceProperty[] {
        const isReservedProperty =
            (property: RDFResourceProperty) => RESERVED_CONTAINER_PROPERTIES.includes(property.name);
        const isReservedType =
            (property: RDFResourceProperty) =>
                property.type === RDFResourcePropertyType.Type &&
                RESERVED_CONTAINER_TYPES.includes(property.value as string);

        return properties.filter(
            property =>
                property.resourceUrl !== resourceUrl ||
                (!isReservedProperty(property) && !isReservedType(property)),
        );
    }

    private processChangeUrlOperations(document: RDFDocument, operations: UpdateOperation[]): void {
        const decantedOperations = decantUpdateOperations(operations);

        for (const changeUrlOperation of decantedOperations[OperationType.ChangeUrl]) {
            const resource = document.resource(changeUrlOperation.resourceUrl);

            if (!resource) continue;

            const updatePropertyOperations = decantedOperations[OperationType.UpdateProperty]
                .filter(operation => operation.propertyResourceUrl === changeUrlOperation.resourceUrl);

            const removePropertyOperations = decantedOperations[OperationType.RemoveProperty]
                .filter(operation => operation.resourceUrl === changeUrlOperation.resourceUrl);

            updatePropertyOperations.forEach(operation => {
                operation.propertyOrProperties = Array.isArray(operation.propertyOrProperties)
                    ? operation
                        .propertyOrProperties
                        .map(property => property.clone(changeUrlOperation.newResourceUrl)) as
                            RDFResourceProperty | ([RDFResourceProperty] & RDFResourceProperty[])
                    : operation.propertyOrProperties.clone(changeUrlOperation.newResourceUrl);
            });
            removePropertyOperations.forEach(operation => operation.resourceUrl = changeUrlOperation.newResourceUrl);

            operations.push(new RemovePropertyOperation(changeUrlOperation.resourceUrl));
            operations.push(
                ...resource.properties
                    .filter(
                        property =>
                            !updatePropertyOperations.some(operation => operation.propertyName === property.name) &&
                            !removePropertyOperations.some(
                                operation => !operation.property || operation.property === property.name,
                            ),
                    )
                    .map(property => new UpdatePropertyOperation(property.clone(changeUrlOperation.newResourceUrl))),
            );

            arrayRemove(operations, changeUrlOperation);
        }
    }

    // TODO this method should remove all UpdatePropertyOperation and use only
    // SetPropertyOperation and RemovePropertyOperation
    private processUpdatePropertyOperations(document: RDFDocument, operations: UpdateOperation[]): void {
        // Diff arrays
        const arrayOperations: UpdateOperation[] = [];
        const arrayProperties: string[] = [];

        for (let index = 0; index < operations.length; index++) {
            const operation = operations[index] as UpdateOperation;

            if (operation.type !== OperationType.UpdateProperty)
                continue;

            if (!Array.isArray(operation.propertyOrProperties) || operation.propertyResourceUrl === null)
                continue;

            const documentValues = document
                .statements
                .filter(
                    statement =>
                        statement.subject.value === operation.propertyResourceUrl &&
                    statement.predicate.value === operation.propertyName,
                )
                .map(statement => statement.object);
            const isLiteralProperty = operation.propertyOrProperties[0].type === RDFResourcePropertyType.Literal;
            const isReference = (property: Quad_Object | RDFResourceProperty) => 'type' in property
                ? property.type === RDFResourcePropertyType.Reference
                : property.termType === 'NamedNode';
            const { added, removed } = arrayDiff<Quad_Object | RDFResourceProperty>(
                documentValues,
                operation.propertyOrProperties,
                (a, b) => a.value === b.value && isReference(a) === isReference(b),
            );

            added.forEach(addedProperty => operations.push(
                new UpdatePropertyOperation(
                    isLiteralProperty
                        ? RDFResourceProperty.literal(
                            operation.propertyResourceUrl,
                            operation.propertyName,
                            addedProperty.value as LiteralValue,
                        )
                        : RDFResourceProperty.reference(
                            operation.propertyResourceUrl,
                            operation.propertyName,
                            addedProperty.value as string,
                        ),
                ),
            ));

            removed.forEach(removedProperty => operations.push(
                new RemovePropertyOperation(
                    operation.propertyResourceUrl as string,
                    operation.propertyName,
                    removedProperty.value,
                ),
            ));

            arrayOperations.push(operation);
            arrayProperties.push(`${operation.propertyResourceUrl}-${operation.propertyName}`);
        }

        arrayOperations.forEach(operation => arrayRemove(operations, operation));

        // Properties that are going to be updated have to be deleted or they'll end up duplicated.
        const updateOperations = operations.filter(
            operation =>
                operation.type === OperationType.UpdateProperty &&
                operation.propertyType !== RDFResourcePropertyType.Type &&
                document.hasProperty(operation.propertyResourceUrl as string, operation.propertyName),
        ) as UpdatePropertyOperation[];

        for (const operation of updateOperations) {
            if (arrayProperties.includes(`${operation.propertyResourceUrl}-${operation.propertyName}`))
                continue;

            operations.push(
                new RemovePropertyOperation(operation.propertyResourceUrl as string, operation.propertyName),
            );
        }
    }

    private async renderProperties(
        url: string | null,
        properties: RDFResourceProperty[],
        format: string,
    ): Promise<string> {
        switch (format) {
            case 'text/turtle':
                return RDFResourceProperty.toTurtle(properties, url);
            case 'application/ld+json': {
                const quads = await turtleToQuads(RDFResourceProperty.toTurtle(properties, url));
                const json = await quadsToJsonLD(quads);

                if (json['@graph'].length !== 1) {
                    throw new Error('Cannot render JSONLD with multiple or no subjects');
                }

                const main = json['@graph'][0] as JsonLD;

                if (isEmpty(main['@id'])) {
                    delete main['@id'];
                }

                return JSON.stringify(main);
            }
        }

        throw new Error(`Unsupported render format: '${format}'`);
    }

    private assertSuccessfulResponse(response: Response, errorMessage: string): void {
        if (Math.floor(response.status / 100) === 2) {
            return;
        }

        throw new UnsuccessfulNetworkRequestError(errorMessage, response);
    }

    private isInternalErrorResponse(response: Response): boolean {
        return Math.floor(response.status / 100) === 5;
    }

}
