import { DocumentNotFound, SoukaiError } from 'soukai';
import { Quad } from 'rdf-js';

import { decantUpdateOperations, decantUpdateOperationsData } from '@/solid/operations/utils';
import { OperationType, UpdateOperation } from '@/solid/operations/Operation';
import RDF, { IRI, RDFParsingError } from '@/solid/utils/RDF';
import RDFDocument from '@/solid/RDFDocument';
import RDFResource from '@/solid/RDFResource';
import RDFResourceProperty, { RDFResourcePropertyType } from '@/solid/RDFResourceProperty';
import RemovePropertyOperation from '@/solid/operations/RemovePropertyOperation';
import UpdatePropertyOperation from '@/solid/operations/UpdatePropertyOperation';

import MalformedDocumentError, { DocumentFormat } from '@/errors/MalformedDocumentError';
import NetworkError from '@/errors/NetworkError';

import Arr from '@/utils/Arr';
import Obj from '@/utils/Obj';
import Url from '@/utils/Url';

export interface RequestOptions {
    headers?: object;
    method?: string;
    body?: string;
}

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

export type Fetch = (url: string, options?: RequestOptions) => Promise<Response>;

export default class SolidClient {

    private fetch: Fetch;

    constructor(fetch: Fetch) {
        this.fetch = async (url, options) => {
            try {
                const response = await fetch(url, options);

                return response;
            } catch (error) {
                throw new NetworkError(`Error fetching ${url}`, error);
            }
        };
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
                property.value === ldpContainer
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
            headers: { 'Accept': 'text/turtle' },
        });

        if (response.status !== 200)
            return null;

        const data = await response.text();

        try {
            const document = await RDF.parseTurtle(data, {
                headers: response.headers,
                baseUrl: url,
            });

            return document;
        } catch (error) {
            throw new MalformedDocumentError(url, DocumentFormat.RDF, error.message);
        }
    }

    public async getDocuments(containerUrl: string, onlyContainers: boolean = false): Promise<RDFDocument[]> {
        try {
            return onlyContainers
                ? await this.getContainerDocuments(containerUrl)
                : await this.getNonContainerDocumentsUsingGlobbing(containerUrl);
        } catch (error) {
            if (error instanceof RDFParsingError)
                throw new MalformedDocumentError(containerUrl, DocumentFormat.RDF, error.message);

            // Due to an existing bug, empty containers return 404
            // see: https://github.com/solid/node-solid-server/issues/900
            console.error(error);

            return [];
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

    public async deleteDocument(url: string): Promise<void> {
        const document = await this.getDocument(url);

        if (document === null)
            return;

        if (document.resource(url)?.isType(IRI('ldp:Container'))) {
            const documents = await Promise.all([
                this.getDocuments(url, true),
                this.getDocuments(url),
            ]);

            await Promise.all(
                Arr.flatten(documents).map(document => this.deleteDocument(document.url!)),
            );
        }

        const response = await this.fetch(url, { method: 'DELETE' });

        this.assertSuccessfulResponse(response, `Error deleting document at ${url}`);
    }

    public async documentExists(url: string): Promise<boolean> {
        const response = await this.fetch(url, {
            headers: { 'Accept': 'text/turtle' },
        });

        if (response.status === 200) {
            const data = await response.text();

            return data.length > 0;
        } else if (response.status === 404) {
            return false;
        } else {
            throw new SoukaiError(
                `Couldn't determine if document at ${url} exists, got ${response.status} response`
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
                    'Slug': url ? Url.parentDirectory(url) : null,
                }),
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
        const response = await this.fetch(containerUrl, { headers: { 'Accept': 'text/turtle' } });

        this.assertSuccessfulResponse(response, `Error getting container documents from ${containerUrl}`);

        const turtleData = await response.text();
        const containerDocument = await RDF.parseTurtle(turtleData, { baseUrl: containerUrl });

        return await Promise.all(
            containerDocument
                .resource(containerUrl)?.getPropertyValues('ldp:contains')
                .map((url: string) => containerDocument.resource(url))
                .filter(resource => resource !== null && resource.isType('ldp:Container'))
                .map((resource: RDFResource) => this.getDocument(resource.url!) as Promise<RDFDocument>)
            || [],
        );
    }

    private async getNonContainerDocumentsUsingGlobbing(containerUrl: string): Promise<RDFDocument[]> {
        const response = await this.fetch(containerUrl + '*', { headers: { 'Accept': 'text/turtle' } });

        this.assertSuccessfulResponse(
            response,
            `Error getting container documents using globbing from ${containerUrl}`,
        );

        const turtleData = await response.text();
        const globbingDocument = await RDF.parseTurtle(turtleData, { baseUrl: containerUrl });
        const statementsByUrl = globbingDocument.statements.reduce(
            (statementsByUrl, statement) => {
                const baseUrl = Url.clean(statement.subject.value, { fragment: false });

                if (!(baseUrl in statementsByUrl))
                    statementsByUrl[baseUrl] = [];

                statementsByUrl[baseUrl].push(statement);

                return statementsByUrl;
            },
            {} as MapObject<Quad[]>,
        );

        return Object.entries(statementsByUrl)
            .map(([url, statements]) => new RDFDocument(url, statements));
    }

    private async updateContainerDocument(document: RDFDocument, operations: UpdateOperation[]): Promise<void> {
        const createRemovePropertyOperation = property => new RemovePropertyOperation(document.url, property);
        const createRemoveTypeOperation = type => new RemovePropertyOperation(document.url, IRI('rdf:type'), type);

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
                            (!value || value === property.value),
                    )
                ),
                document.url,
        );

        const response = await this.fetch(document.url, {
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
        const isReservedProperty = property => Arr.contains(RESERVED_CONTAINER_PROPERTIES, property.name);
        const isReservedType = property =>
            property.type === RDFResourcePropertyType.Type &&
            Arr.contains(RESERVED_CONTAINER_TYPES, property.value);

        return properties.filter(
            property =>
                property.resourceUrl !== resourceUrl ||
                (!isReservedProperty(property) && !isReservedType(property))
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
                    .filter(property =>
                        !updatePropertyOperations.some(operation => operation.property.name === property.name) &&
                        !removePropertyOperations.some(operation => !operation.property || operation.property === property.name),
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
                document.hasProperty(operation.property.resourceUrl!, operation.property.name)
        ) as UpdatePropertyOperation[];

        for (const { property } of updateOperations) {
            operations.push(new RemovePropertyOperation(property.resourceUrl!, property.name));
        }
    }

    private assertSuccessfulResponse(response: Response, errorMessage: string): void {
        if (Math.floor(response.status / 100) === 2)
            return;

        throw new SoukaiError(`${errorMessage}, returned ${response.status} status code`);
    }

}
