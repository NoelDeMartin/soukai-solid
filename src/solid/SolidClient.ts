import { DocumentNotFound, SoukaiError } from 'soukai';
import type { Quad } from 'rdf-js';

import { decantUpdateOperations, decantUpdateOperationsData } from '@/solid/operations/utils';
import { OperationType } from '@/solid/operations/Operation';
import IRI from '@/solid/utils/IRI';
import RDFDocument, { RDFParsingError } from '@/solid/RDFDocument';
import RDFResourceProperty, { RDFResourcePropertyType } from '@/solid/RDFResourceProperty';
import RemovePropertyOperation from '@/solid/operations/RemovePropertyOperation';
import UpdatePropertyOperation from '@/solid/operations/UpdatePropertyOperation';
import type { UpdateOperation } from '@/solid/operations/Operation';

import MalformedDocumentError, { DocumentFormat } from '@/errors/MalformedDocumentError';
import NetworkError from '@/errors/NetworkError';

import Arr from '@/utils/Arr';
import Obj from '@/utils/Obj';
import Url from '@/utils/Url';

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

export type Fetch = (input: RequestInfo, options?: RequestInit) => Promise<Response>;

export type SolidClientConfig = {
    useGlobbing: boolean;
    concurrentFetchBatchSize: number | null;
};

export default class SolidClient {

    private fetch: Fetch;
    private config: SolidClientConfig;

    constructor(fetch: Fetch) {
        this.fetch = async (input, options) => {
            try {
                const response = await fetch(input, options);

                return response;
            } catch (error) {
                const url = typeof input === 'object' ? input.url : input;

                throw new NetworkError(`Error fetching ${url}`, error);
            }
        };
        this.config = {
            useGlobbing: false,
            concurrentFetchBatchSize: 5,
        };
    }

    public setConfig(config: Partial<SolidClientConfig>): void {
        Object.assign(this.config, config);
    }

    public async createDocument(
        parentUrl: string,
        url: string | null = null,
        properties: RDFResourceProperty[] = [],
    ): Promise<string> {
        const ldpContainer = IRI('ldp:Container');
        const isContainer = properties.some(
            property =>
                property.resourceUrl === url &&
                property.type === RDFResourcePropertyType.Type &&
                property.value === ldpContainer,
        );

        // TODO some of these operations can overwrite an existing document.
        // In this project that's ok because the existence of the document is checked
        // in the engine before calling this method, but it should be fixed for correctness.
        return isContainer
            ? this.createContainerDocument(parentUrl, url, properties)
            : this.createNonContainerDocument(parentUrl, url, properties);
    }

    public async getDocument(url: string): Promise<RDFDocument | null> {
        const response = await this.fetch(url, {
            headers: { Accept: 'text/turtle' },
        });

        if (response.status !== 200)
            return null;

        const data = await response.text();

        try {
            const document = await RDFDocument.fromTurtle(data, {
                headers: response.headers,
                baseUrl: url,
            });

            return document;
        } catch (error) {
            throw new MalformedDocumentError(url, DocumentFormat.RDF, error.message);
        }
    }

    public async getDocuments(containerUrl: string, needsContainers: boolean = false): Promise<RDFDocument[]> {
        try {
            return (this.config.useGlobbing && !needsContainers)
                ? await this.getContainerDocumentsUsingGlobbing(containerUrl)
                : await this.getContainerDocuments(containerUrl);
        } catch (error) {
            if (error instanceof RDFParsingError)
                throw new MalformedDocumentError(containerUrl, DocumentFormat.RDF, error.message);

            if (this.config.useGlobbing) {
                // Due to an existing bug, empty containers return 404
                // see: https://github.com/solid/node-solid-server/issues/900
                console.error(error);

                return [];
            }

            throw error;
        }
    }

    public async updateDocument(url: string, operations: UpdateOperation[]): Promise<void> {
        if (operations.length === 0)
            return;

        const document = await this.getDocument(url);

        if (document === null)
            throw new DocumentNotFound(url);

        this.processChangeUrlOperations(document, operations);
        this.processUpdatePropertyOperations(document, operations);

        document.resource(url)?.isType(IRI('ldp:Container'))
            ? await this.updateContainerDocument(document, operations)
            : await this.updateNonContainerDocument(document, operations);
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
        url: string | null,
        properties: RDFResourceProperty[],
    ): Promise<string> {
        if (url && !url.startsWith(parentUrl))
            throw new SoukaiError('Explicit document url should start with the parent url');

        if (url && !url.endsWith('/'))
            throw new SoukaiError(`Container urls must end with a trailing slash, given ${url}`);

        const containerLocation = url ? `at ${url}` : `under ${parentUrl}`;
        const response = await this.fetch(
            parentUrl,
            {
                method: 'POST',
                headers: Obj.withoutEmpty({
                    'Content-Type': 'text/turtle',
                    'Link': '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',
                    'Slug': url ? Url.directoryName(url) : null,
                }) as Record<string, string>,
                body: RDFResourceProperty.toTurtle(
                    this.withoutReservedContainerProperties(url, properties),
                    url,
                ),
            },
        );

        this.assertSuccessfulResponse(response, `Error creating container ${containerLocation}`);

        return url || Url.resolve(parentUrl, response.headers.get('Location') || '');
    }

    private async createNonContainerDocument(
        parentUrl: string,
        url: string | null,
        properties: RDFResourceProperty[],
    ): Promise<string> {
        if (!url) {
            const response = await this.fetch(parentUrl, {
                headers: { 'Content-Type': 'text/turtle' },
                method: 'POST',
                body: RDFResourceProperty.toTurtle(properties, url),
            });

            this.assertSuccessfulResponse(response, `Error creating document under ${parentUrl}`);

            return Url.resolve(parentUrl, response.headers.get('Location') || '');
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
        const containerDocument = await RDFDocument.fromTurtle(turtleData, { baseUrl: containerUrl });

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
        const globbingDocument = await RDFDocument.fromTurtle(turtleData, { baseUrl: containerUrl });
        const statementsByUrl = globbingDocument.statements.reduce(
            (statementsByUrl, statement) => {
                const baseUrl = Url.clean(statement.subject.value, { fragment: false });

                if (!(baseUrl in statementsByUrl))
                    statementsByUrl[baseUrl] = [];

                statementsByUrl[baseUrl].push(statement);

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
            document.clone(document.metadata.describedBy || `${document.url}.meta`),
            operations,
        );
    }

    private async updateNonContainerDocument(document: RDFDocument, operations: UpdateOperation[]): Promise<void> {
        const [updatedProperties, removedProperties] = decantUpdateOperationsData(operations);
        const inserts = RDFResourceProperty.toTurtle(updatedProperties, document.url);
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
            body: Arr.filter([
                deletes.length > 0 && `DELETE DATA { ${deletes} }`,
                inserts.length > 0 && `INSERT DATA { ${inserts} }`,
            ]).join(' ; '),
        });

        this.assertSuccessfulResponse(response, `Error updating document at ${document.url}`);
    }

    private withoutReservedContainerProperties(
        resourceUrl: string | null,
        properties: RDFResourceProperty[],
    ): RDFResourceProperty[] {
        const isReservedProperty =
            (property: RDFResourceProperty) => Arr.contains(RESERVED_CONTAINER_PROPERTIES, property.name);
        const isReservedType =
            (property: RDFResourceProperty) =>
                property.type === RDFResourcePropertyType.Type &&
                Arr.contains(RESERVED_CONTAINER_TYPES, property.value);

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
                .filter(operation => operation.property.resourceUrl === changeUrlOperation.resourceUrl);

            const removePropertyOperations = decantedOperations[OperationType.RemoveProperty]
                .filter(operation => operation.resourceUrl === changeUrlOperation.resourceUrl);

            updatePropertyOperations.forEach(
                operation => operation.property = operation.property.clone(changeUrlOperation.newResourceUrl),
            );
            removePropertyOperations.forEach(operation => operation.resourceUrl = changeUrlOperation.newResourceUrl);

            operations.push(new RemovePropertyOperation(changeUrlOperation.resourceUrl));
            operations.push(
                ...resource.properties
                    .filter(
                        property =>
                            !updatePropertyOperations.some(operation => operation.property.name === property.name) &&
                            !removePropertyOperations.some(
                                operation => !operation.property || operation.property === property.name,
                            ),
                    )
                    .map(property => new UpdatePropertyOperation(property.clone(changeUrlOperation.newResourceUrl))),
            );

            Arr.removeItem(operations, changeUrlOperation);
        }
    }

    private processUpdatePropertyOperations(document: RDFDocument, operations: UpdateOperation[]): void {
        // Properties that are going to be updated have to be deleted or they'll end up duplicated.
        const updateOperations = operations.filter(
            operation =>
                operation.type === OperationType.UpdateProperty &&
                operation.property.type !== RDFResourcePropertyType.Type &&
                document.hasProperty(operation.property.resourceUrl as string, operation.property.name),
        ) as UpdatePropertyOperation[];

        for (const { property } of updateOperations) {
            operations.push(new RemovePropertyOperation(property.resourceUrl as string, property.name));
        }
    }

    private assertSuccessfulResponse(response: Response, errorMessage: string): void {
        if (Math.floor(response.status / 100) === 2)
            return;

        throw new SoukaiError(`${errorMessage}, returned ${response.status} status code`);
    }

}
