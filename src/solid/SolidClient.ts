import { DocumentNotFound, SoukaiError } from 'soukai';
import { Quad } from 'rdf-js';

import RDF, { IRI, RDFParsingError } from '@/solid/utils/RDF';
import RDFDocument from '@/solid/RDFDocument';
import RDFResource from '@/solid/RDFResource';
import RDFResourceProperty, { RDFResourcePropertyType } from '@/solid/RDFResourceProperty';

import { DocumentFormat, MalformedDocumentError } from '@/errors/MalformedDocumentError';

import Arr from '@/utils/Arr';
import Url from '@/utils/Url';

interface RequestOptions {
    headers?: object;
    method?: string;
    body?: string;
}

export type Fetch = (url: string, options?: RequestOptions) => Promise<Response>;

export default class SolidClient {

    private fetch: Fetch;

    constructor(fetch: Fetch) {
        this.fetch = fetch;
    }

    public async createDocument(
        parentUrl: string,
        url: string | null = null,
        properties: RDFResourceProperty[] = [],
    ): Promise<RDFDocument> {
        const ldpContainer = IRI('ldp:Container');
        const turtleData = properties
            .map(property => property.toTurtle() + ' .')
            .join("\n");
        const isContainer = properties.some(
            property =>
                property.resourceUrl === url &&
                property.type === RDFResourcePropertyType.Type &&
                property.value === ldpContainer
        );

        return isContainer
            ? this.createContainerDocument(parentUrl, url, turtleData)
            : this.createNonContainerDocument(parentUrl, url, turtleData);
    }

    public async getDocument(url: string): Promise<RDFDocument | null> {
        const response = await this.fetch(url, {
            headers: { 'Accept': 'text/turtle' },
        });

        if (response.status !== 200) {
            return null;
        }

        const data = await response.text();

        try {
            const document = await RDF.parseTurtle(data, { baseUrl: url });

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
            if (error instanceof RDFParsingError) {
                throw new MalformedDocumentError(containerUrl, DocumentFormat.RDF, error.message);
            }

            // Due to an existing bug, empty containers return 404
            // see: https://github.com/solid/node-solid-server/issues/900
            console.error(error);

            return [];
        }
    }

    public async updateDocument(
        url: string,
        updatedProperties: RDFResourceProperty[],
        removedProperties: [string, string?][],
    ): Promise<void> {
        if (updatedProperties.length + removedProperties.length === 0)
            return;

        const document = await this.getDocument(url);

        if (document === null)
            throw new DocumentNotFound(url);

        // We need to remove the previous value of updated properties or else they'll be duplicated
        removedProperties.push(
            ...updatedProperties
                .filter(property => property.type !== RDFResourcePropertyType.Type)
                .filter(property => document.hasProperty(property.resourceUrl!, property.name))
                .map(property => [property.resourceUrl, property.name] as [string, string]),
        );

        document.resource(url)?.isType(IRI('ldp:Container'))
            ? await this.updateContainerDocument(document, updatedProperties, removedProperties)
            : await this.updateNonContainerDocument(document, updatedProperties, removedProperties);
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

        await this.fetch(url, { method: 'DELETE' });
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
        data: string,
    ): Promise<RDFDocument> {
        if (!url) {
            const response = await this.fetch(
                parentUrl,
                {
                    headers: {
                        'Content-Type': 'text/turtle',
                        'Link': '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',
                    },
                    method: 'POST',
                    body: data,
                },
            );

            return RDF.parseTurtle(
                data,
                { baseUrl: Url.resolve(parentUrl, response.headers.get('Location') || '') },
            );
        }

        if (!url.startsWith(parentUrl))
            throw new SoukaiError('Explicit document url should start with the parent url');

        if (!url.endsWith('/'))
            throw new SoukaiError(`Container urls must end with a trailing slash, given ${url}`);

        await this.fetch(
            parentUrl,
            {
                method: 'POST',
                body: data,
                headers: {
                    'Content-Type': 'text/turtle',
                    'Link': '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',
                    'Slug': Url.filename(url.substr(0, url.length - 1)),
                },
            },
        );

        return RDF.parseTurtle(data, { baseUrl: url });
    }

    private async createNonContainerDocument(
        parentUrl: string,
        url: string | null,
        data: string,
    ): Promise<RDFDocument> {
        if (!url) {
            const response = await this.fetch(parentUrl, {
                headers: { 'Content-Type': 'text/turtle' },
                method: 'POST',
                body: data,
            });

            return RDF.parseTurtle(
                data,
                { baseUrl: Url.resolve(parentUrl, response.headers.get('Location') || '') },
            );
        }

        if (!url.startsWith(parentUrl))
            throw new SoukaiError('A minted document url should start with the parent url');

        await this.fetch(url, {
            headers: { 'Content-Type': 'text/turtle' },
            method: 'PUT',
            body: data,
        });

        return RDF.parseTurtle(data, { baseUrl: url });
    }

    private async getContainerDocuments(containerUrl: string): Promise<RDFDocument[]> {
        const containerDocument =
            await this
                .fetch(containerUrl, { headers: { 'Accept': 'text/turtle' } })
                .then(res => res.text())
                .then(data => RDF.parseTurtle(data, { baseUrl: containerUrl }));

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
        const data = await this
            .fetch(containerUrl + '*', { headers: { 'Accept': 'text/turtle' } })
            .then(res => res.text());

        const globbingDocument = await RDF.parseTurtle(data, { baseUrl: containerUrl });
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

    private async updateContainerDocument(
        document: RDFDocument,
        updatedProperties: RDFResourceProperty[],
        removedProperties: [string, string?][],
    ): Promise<void> {
        // TODO this may change in future versions of node-solid-server
        // https://github.com/solid/node-solid-server/issues/1040
        const url = document.url;
        const properties = document.properties.filter(property => {
            return property.name !== IRI('ldp:contains')
                && property.name !== 'http://www.w3.org/ns/posix/stat#mtime'
                && property.name !== 'http://www.w3.org/ns/posix/stat#size'
                && !removedProperties.some(
                    ([resourceUrl, name]) =>
                        resourceUrl === property.resourceUrl &&
                        (!name || name === property.name),
                );
        });

        properties.push(...updatedProperties);

        const response = await this.fetch(
            url + '.meta',
            {
                method: 'PUT',
                body: properties
                    .map(property => property.toTurtle() + ' .')
                    .join("\n"),
                headers: {
                    'Content-Type': 'text/turtle',
                },
            }
        );

        if (response.status !== 201) {
            throw new SoukaiError(
                `Error updating container document at ${document.url}, returned status code ${response.status}`,
            );
        }
    }

    private async updateNonContainerDocument(
        document: RDFDocument,
        updatedProperties: RDFResourceProperty[],
        removedProperties: [string, string?][],
    ): Promise<void> {
        const inserts = updatedProperties
            .map(property => property.toTurtle() + ' .')
            .join('\n');

        const deletes = document.properties
            .filter(property => removedProperties.some(([resourceUrl, name]) => {
                return resourceUrl === property.resourceUrl
                    && (!name || name === property.name);
            }))
            .map(property => property.toTurtle() + ' .')
            .join('\n');

        const operations = [
            `solid:patches <${document.url}>`,
            inserts.length > 0 ? `solid:inserts { ${inserts} }` : null,
            deletes.length > 0 ? `solid:deletes { ${deletes} }` : null,
        ]
            .filter(part => part !== null)
            .join(';');

        const response = await this.fetch(
            document.url!,
            {
                method: 'PATCH',
                body: `
                    @prefix solid: <http://www.w3.org/ns/solid/terms#> .
                    <> ${operations} .
                `,
                headers: {
                    'Content-Type': 'text/n3',
                },
            },
        );

        if (response.status !== 200)
            throw new SoukaiError(
                `Error updating document at ${document.url}, returned status code ${response.status}`,
            );
    }

}
