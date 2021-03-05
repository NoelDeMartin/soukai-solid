import Faker from 'faker';

import MalformedDocumentError from '@/errors/MalformedDocumentError';

import Str from '@/utils/Str';
import Url from '@/utils/Url';

import ChangeUrlOperation from '@/solid/operations/ChangeUrlOperation';
import IRI from '@/solid/utils/IRI';
import RDFResourceProperty, { RDFResourcePropertyType } from '@/solid/RDFResourceProperty';
import RemovePropertyOperation from '@/solid/operations/RemovePropertyOperation';
import SolidClient from '@/solid/SolidClient';
import UpdatePropertyOperation from '@/solid/operations/UpdatePropertyOperation';
import type RDFDocument from '@/solid/RDFDocument';

import StubFetcher from '@/testing/lib/stubs/StubFetcher';

describe('SolidClient', () => {

    let client: SolidClient;

    beforeEach(() => {
        StubFetcher.reset();
        client = new SolidClient(StubFetcher.fetch.bind(StubFetcher));
    });

    it('creates documents', async () => {
        // Arrange
        const parentUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(Faker.random.word()));
        const documentUrl = Url.resolve(parentUrl, Faker.random.uuid());
        const resourceUrl = `${documentUrl}#it`;
        const secondResourceUrl = `${documentUrl}#someone-else`;
        const name = Faker.random.word();
        const firstType = Url.resolve(Faker.internet.url(), Str.slug(Faker.random.word()));
        const secondType = Url.resolve(Faker.internet.url(), Str.slug(Faker.random.word()));

        StubFetcher.addFetchResponse();

        // Act
        const url = await client.createDocument(
            parentUrl,
            documentUrl,
            [
                RDFResourceProperty.type(documentUrl, IRI('ldp:Document')),
                RDFResourceProperty.literal(resourceUrl, IRI('foaf:name'), name),
                RDFResourceProperty.type(resourceUrl, firstType),
                RDFResourceProperty.type(resourceUrl, secondType),
                RDFResourceProperty.reference(secondResourceUrl, IRI('foaf:knows'), resourceUrl),
            ],
        );

        // Assert
        expect(url).toEqual(documentUrl);
        expect(StubFetcher.fetch).toHaveBeenCalledWith(documentUrl, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/sparql-update',
                'If-None-Match': '*',
            },
            body: expect.anything(),
        });

        const body = (StubFetcher.fetch as any).mock.calls[0][1].body;

        await expect(body).toEqualSPARQL(`
            INSERT DATA {
                <> a <http://www.w3.org/ns/ldp#Document> .
                <#it> <http://xmlns.com/foaf/0.1/name> "${name}" .
                <#it> a <${firstType}> .
                <#it> a <${secondType}> .
                <#someone-else> <http://xmlns.com/foaf/0.1/knows> <#it> .
            }
        `);
    });

    it('creates documents without minted url', async () => {
        // Arrange
        const parentUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(Faker.random.word()));
        const documentUrl = Url.resolve(parentUrl, Faker.random.uuid());

        StubFetcher.addFetchResponse('', { Location: documentUrl }, 201);

        // Act
        const url = await client.createDocument(
            parentUrl,
            null,
            [
                RDFResourceProperty.type(null, IRI('foaf:Person')),
            ],
        );

        // Assert
        expect(url).toEqual(documentUrl);
        expect(StubFetcher.fetch).toHaveBeenCalledWith(parentUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/turtle' },
            body: '<> a <http://xmlns.com/foaf/0.1/Person> .',
        });
    });

    it('creates container documents', async () => {
        // Arrange
        const label = Faker.random.word();
        const parentUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(Faker.random.word()));
        const containerUrl = Url.resolveDirectory(parentUrl, Str.slug(label));

        StubFetcher.addFetchResponse('', {}, 201);

        // Act
        const url = await client.createDocument(
            parentUrl,
            containerUrl,
            [
                RDFResourceProperty.literal(containerUrl, IRI('rdfs:label'), label),
                RDFResourceProperty.literal(containerUrl, IRI('purl:modified'), new Date()),
                RDFResourceProperty.type(containerUrl, IRI('ldp:Container')),
            ],
        );

        // Assert
        expect(url).toEqual(containerUrl);
        expect(StubFetcher.fetch).toHaveBeenCalledWith(parentUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/turtle',
                'Link': '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',
                'Slug': Str.slug(label),
            },
            body: `<> <http://www.w3.org/2000/01/rdf-schema#label> "${label}" .`,
        });
    });

    it('creates container documents without a minted url', async () => {
        // Arrange
        const parentUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(Faker.random.word()));
        const containerUrl = Url.resolveDirectory(parentUrl, Str.slug(Faker.random.word()));

        StubFetcher.addFetchResponse('', { Location: containerUrl }, 201);

        // Act
        const url = await client.createDocument(
            parentUrl,
            null,
            [
                RDFResourceProperty.type(null, IRI('ldp:Container')),
            ],
        );

        // Assert
        expect(url).toEqual(containerUrl);
        expect(StubFetcher.fetch).toHaveBeenCalledWith(parentUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/turtle',
                'Link': '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',
            },
            body: '',
        });
    });

    it('gets one document', async () => {
        // Arrange
        const url = Faker.internet.url();
        const data = `<${url}> <http://xmlns.com/foaf/0.1/name> "Foo Bar" .`;

        StubFetcher.addFetchResponse(data);

        // Act
        const document = await client.getDocument(url) as RDFDocument;

        // Assert
        expect(document).not.toBeNull();
        expect(document.requireResource(url).name).toEqual('Foo Bar');

        expect(StubFetcher.fetch).toHaveBeenCalledWith(url, {
            headers: { Accept: 'text/turtle' },
        });
    });

    it('getting non-existent document returns null', async () => {
        // Arrange
        StubFetcher.addFetchNotFoundResponse();

        // Act
        const document = await client.getDocument(Faker.internet.url());

        // Assert
        expect(document).toBeNull();
    });

    it('gets documents using a trailing slash', async () => {
        // Arrange
        const containerUrl = Url.resolveDirectory(
            Faker.internet.url(),
            Str.slug(Faker.random.word()),
        );
        const data = `
            <foobar>
                a <http://xmlns.com/foaf/0.1/Person> ;
                <http://xmlns.com/foaf/0.1/name> "Foo Bar" .
        `;

        StubFetcher.addFetchResponse(data);

        // Act
        const documents = await client.getDocuments(containerUrl);

        // Assert
        expect(documents).toHaveLength(1);

        expect(documents[0].url).toEqual(containerUrl + 'foobar');
        expect(documents[0].requireResource(containerUrl + 'foobar').url).toEqual(containerUrl + 'foobar');
        expect(documents[0].requireResource(containerUrl + 'foobar').name).toEqual('Foo Bar');
        expect(documents[0].requireResource(containerUrl + 'foobar').types).toEqual([IRI('foaf:Person')]);

        expect(StubFetcher.fetch).toHaveBeenCalledWith(containerUrl + '*', {
            headers: { Accept: 'text/turtle' },
        });
    });

    it('getting documents with globbing does not mix document properties', async () => {
        // Arrange
        const containerUrl = Faker.internet.url();
        const data = `
            <${containerUrl}/foo>
                a <http://xmlns.com/foaf/0.1/Person> ;
                <http://xmlns.com/foaf/0.1/name> "Foo" .
            <${containerUrl}/bar>
                a <http://xmlns.com/foaf/0.1/Person> ;
                <http://xmlns.com/foaf/0.1/name> "Bar" .
            <${containerUrl}/bar#baz>
                a <http://xmlns.com/foaf/0.1/Person> ;
                <http://xmlns.com/foaf/0.1/name> "Baz" .
        `;

        StubFetcher.addFetchResponse(data);

        // Act
        const documents = await client.getDocuments(containerUrl);

        // Assert
        expect(documents).toHaveLength(2);

        const fooProperties = documents[0].properties;
        expect(Object.values(fooProperties)).toHaveLength(2);
        expect(
            fooProperties.find(
                property =>
                    property.type === RDFResourcePropertyType.Type &&
                    property.value === IRI('foaf:Person'),
            ),
        )
            .not.toBeUndefined();
        expect(
            fooProperties.find(
                property =>
                    property.type === RDFResourcePropertyType.Literal &&
                    property.name === IRI('foaf:name') &&
                    property.value === 'Foo',
            ),
        )
            .not.toBeUndefined();

        expect(documents[1].resources).toHaveLength(2);
        expect(documents[1].requireResource(`${containerUrl}/bar`).url).toEqual(`${containerUrl}/bar`);
        expect(documents[1].resources[1].url).toEqual(`${containerUrl}/bar#baz`);

        const barProperties = documents[1].properties;
        expect(Object.values(barProperties)).toHaveLength(4);
        expect(
            barProperties.find(
                property =>
                    property.type === RDFResourcePropertyType.Type &&
                    property.value === IRI('foaf:Person'),
            ),
        )
            .not.toBeUndefined();
        expect(
            barProperties.find(
                property =>
                    property.resourceUrl === `${containerUrl}/bar` &&
                    property.type === RDFResourcePropertyType.Literal &&
                    property.name === IRI('foaf:name') &&
                    property.value === 'Bar',
            ),
        )
            .not.toBeUndefined();
        expect(
            barProperties.find(
                property =>
                    property.resourceUrl === `${containerUrl}/bar#baz` &&
                    property.type === RDFResourcePropertyType.Literal &&
                    property.name === IRI('foaf:name') &&
                    property.value === 'Baz',
            ),
        )
            .not.toBeUndefined();
    });

    it('getting container documents does not use globbing', async () => {
        // Arrange
        const containerUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(Faker.random.word()));
        const type = Url.resolve(Faker.internet.url(), Str.slug(Faker.random.word()));

        StubFetcher.addFetchResponse(`
            <>
                <http://www.w3.org/ns/ldp#contains> <foo>, <bar> .
            <foo>
                a <http://www.w3.org/ns/ldp#Container> .
            <bar>
                a <http://www.w3.org/ns/ldp#Container> .
        `);
        StubFetcher.addFetchResponse(`
            <${containerUrl}foo>
                a <http://www.w3.org/ns/ldp#Container>, <${type}> ;
                <http://xmlns.com/foaf/0.1/name> "Foo" .
        `);
        StubFetcher.addFetchResponse(`
            <${containerUrl}bar>
                a <http://www.w3.org/ns/ldp#Container> ;
                <http://xmlns.com/foaf/0.1/name> "Bar" .
        `);

        // Act
        const documents = await client.getDocuments(containerUrl, true);

        // Assert
        expect(documents).toHaveLength(2);

        expect(documents[0].url).toEqual(`${containerUrl}foo`);
        expect(documents[0].requireResource(`${containerUrl}foo`).url).toEqual(`${containerUrl}foo`);
        expect(documents[0].requireResource(`${containerUrl}foo`).name).toEqual('Foo');
        expect(documents[0].requireResource(`${containerUrl}foo`).types).toEqual([
            IRI('ldp:Container'),
            type,
        ]);

        expect(documents[1].url).toEqual(`${containerUrl}bar`);
        expect(documents[1].requireResource(`${containerUrl}bar`).url).toEqual(`${containerUrl}bar`);
        expect(documents[1].requireResource(`${containerUrl}bar`).name).toEqual('Bar');
        expect(documents[1].requireResource(`${containerUrl}bar`).types).toEqual([IRI('ldp:Container')]);

        expect(StubFetcher.fetch).toHaveBeenCalledWith(containerUrl, {
            headers: { Accept: 'text/turtle' },
        });
        expect(StubFetcher.fetch).toHaveBeenCalledWith(`${containerUrl}foo`, {
            headers: { Accept: 'text/turtle' },
        });
        expect(StubFetcher.fetch).toHaveBeenCalledWith(`${containerUrl}bar`, {
            headers: { Accept: 'text/turtle' },
        });
    });

    it('updates documents', async () => {
        // Arrange
        const documentUrl = Faker.internet.url();
        const url = `${documentUrl}#it`;
        const data = `
            <${url}>
                <http://xmlns.com/foaf/0.1/name> "Johnathan" ;
                <http://xmlns.com/foaf/0.1/surname> "Doe" ;
                <http://xmlns.com/foaf/0.1/givenName> "John" .
        `;
        const operations = [
            new UpdatePropertyOperation(RDFResourceProperty.literal(url, 'http://xmlns.com/foaf/0.1/name', 'John Doe')),
            new RemovePropertyOperation(url, 'http://xmlns.com/foaf/0.1/surname'),
            new RemovePropertyOperation(url, 'http://xmlns.com/foaf/0.1/givenName'),
        ];

        StubFetcher.addFetchResponse(data);
        StubFetcher.addFetchResponse();

        // Act
        await client.updateDocument(documentUrl, operations);

        // Assert
        expect(StubFetcher.fetch).toHaveBeenCalledWith(
            documentUrl,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/sparql-update' },
                body: expect.anything(),
            },
        );

        const body = (StubFetcher.fetch as any).mock.calls[1][1].body;

        await expect(body).toEqualSPARQL(`
            DELETE DATA {
                <#it> <http://xmlns.com/foaf/0.1/name> "Johnathan" .
                <#it> <http://xmlns.com/foaf/0.1/surname> "Doe" .
                <#it> <http://xmlns.com/foaf/0.1/givenName> "John" .
            } ;
            INSERT DATA {
                <#it> <http://xmlns.com/foaf/0.1/name> "John Doe" .
            }
        `);
    });

    it('updates container documents', async () => {
        // Arrange
        const containerUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(Faker.random.word()));
        const metaDocumentName = '.' + Str.slug(Faker.random.word());
        const metaDocumentUrl = containerUrl + metaDocumentName;
        const data = `
            <${containerUrl}>
                a <http://www.w3.org/ns/ldp#Container> ;
                <http://xmlns.com/foaf/0.1/name> "Jonathan" ;
                <http://xmlns.com/foaf/0.1/surname> "Doe" ;
                <http://xmlns.com/foaf/0.1/givenName> "John" .
        `;
        const operations = [
            new UpdatePropertyOperation(
                RDFResourceProperty.literal(containerUrl, 'http://xmlns.com/foaf/0.1/name', 'John Doe'),
            ),
            new RemovePropertyOperation(containerUrl, 'http://xmlns.com/foaf/0.1/surname'),
            new RemovePropertyOperation(containerUrl, 'http://xmlns.com/foaf/0.1/givenName'),
        ];

        StubFetcher.addFetchResponse(data, { Link: `<${metaDocumentName}>; rel="describedBy"` });
        StubFetcher.addFetchResponse();

        // Act
        await client.updateDocument(containerUrl, operations);

        // Assert
        expect(StubFetcher.fetch).toHaveBeenCalledWith(
            metaDocumentUrl,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/sparql-update' },
                body: expect.anything(),
            },
        );

        const body = (StubFetcher.fetch as any).mock.calls[1][1].body;

        await expect(body).toEqualSPARQL(`
            DELETE DATA {
                <${containerUrl}> a <http://www.w3.org/ns/ldp#Container> .
                <${containerUrl}> <http://xmlns.com/foaf/0.1/name> "Jonathan" .
                <${containerUrl}> <http://xmlns.com/foaf/0.1/surname> "Doe" .
                <${containerUrl}> <http://xmlns.com/foaf/0.1/givenName> "John" .
            } ;
            INSERT DATA {
                <${containerUrl}> <http://xmlns.com/foaf/0.1/name> "John Doe" .
            }
        `);
    });

    it('changes resource urls', async () => {
        // Arrange
        const legacyParentUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(Faker.random.word()));
        const legacyDocumentUrl = Url.resolve(legacyParentUrl, Faker.random.uuid());
        const parentUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(Faker.random.word()));
        const documentUrl = Url.resolve(parentUrl, Faker.random.uuid());
        const firstResourceUrl = legacyDocumentUrl;
        const secondResourceUrl = `${legacyDocumentUrl}#someone-else`;
        const newFirstResourceUrl = `${documentUrl}#it`;
        const newSecondResourceUrl = `${documentUrl}#someone-else`;
        const data = `
            <${firstResourceUrl}>
                <http://xmlns.com/foaf/0.1/name> "Johnathan" ;
                <http://xmlns.com/foaf/0.1/surname> "Doe" ;
                <http://xmlns.com/foaf/0.1/givenName> "John" .
            <${secondResourceUrl}>
                <http://xmlns.com/foaf/0.1/name> "Amy" ;
                <http://xmlns.com/foaf/0.1/surname> "Doe" ;
                <http://xmlns.com/foaf/0.1/knows> <${firstResourceUrl}> .
        `;
        const operations = [
            new ChangeUrlOperation(firstResourceUrl, newFirstResourceUrl),
            new ChangeUrlOperation(secondResourceUrl, newSecondResourceUrl),
            new UpdatePropertyOperation(
                RDFResourceProperty.reference(
                    secondResourceUrl,
                    'http://xmlns.com/foaf/0.1/knows',
                    newFirstResourceUrl,
                ),
            ),
        ];

        StubFetcher.addFetchResponse(data);
        StubFetcher.addFetchResponse();

        // Act
        await client.updateDocument(documentUrl, operations);

        // Assert
        expect(StubFetcher.fetch).toHaveBeenCalledWith(
            documentUrl,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/sparql-update' },
                body: expect.anything(),
            },
        );

        const body = (StubFetcher.fetch as any).mock.calls[1][1].body;

        await expect(body).toEqualSPARQL(`
            DELETE DATA {
                <${firstResourceUrl}> <http://xmlns.com/foaf/0.1/name> "Johnathan" .
                <${firstResourceUrl}> <http://xmlns.com/foaf/0.1/surname> "Doe" .
                <${firstResourceUrl}> <http://xmlns.com/foaf/0.1/givenName> "John" .
                <${secondResourceUrl}> <http://xmlns.com/foaf/0.1/name> "Amy" .
                <${secondResourceUrl}> <http://xmlns.com/foaf/0.1/surname> "Doe" .
                <${secondResourceUrl}> <http://xmlns.com/foaf/0.1/knows> <${firstResourceUrl}> .
            } ;
            INSERT DATA {
                <#someone-else> <http://xmlns.com/foaf/0.1/knows> <#it> .
                <#it> <http://xmlns.com/foaf/0.1/name> "Johnathan" .
                <#it> <http://xmlns.com/foaf/0.1/surname> "Doe" .
                <#it> <http://xmlns.com/foaf/0.1/givenName> "John" .
                <#someone-else> <http://xmlns.com/foaf/0.1/name> "Amy" .
                <#someone-else> <http://xmlns.com/foaf/0.1/surname> "Doe" .
            }
        `);
    });

    it('adds new properties when updating', async () => {
        // Arrange
        const url = Faker.internet.url();
        const data = `<${url}> a <http://xmlns.com/foaf/0.1/Person> .`;
        const operations = [
            new UpdatePropertyOperation(RDFResourceProperty.literal(url, 'http://xmlns.com/foaf/0.1/name', 'John Doe')),
        ];

        StubFetcher.addFetchResponse(data);
        StubFetcher.addFetchResponse();

        // Act
        await client.updateDocument(url, operations);

        // Assert
        expect(StubFetcher.fetch).toHaveBeenCalledWith(
            url,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/sparql-update' },
                body: expect.anything(),
            },
        );

        const body = (StubFetcher.fetch as any).mock.calls[1][1].body;

        await expect(body).toEqualSPARQL(`
            INSERT DATA {
                <> <http://xmlns.com/foaf/0.1/name> "John Doe" .
            }
        `);
    });

    it('deletes all properties from a resource within a document', async () => {
        // Arrange
        const documentUrl = Faker.internet.url();
        const url = `${documentUrl}#it`;
        const data = `
            <${documentUrl}>
                a <http://www.w3.org/ns/ldp#Resource> .
            <${url}>
                <http://xmlns.com/foaf/0.1/name> "Johnathan" ;
                <http://xmlns.com/foaf/0.1/surname> "Doe" ;
                <http://xmlns.com/foaf/0.1/givenName> "John" .
        `;

        StubFetcher.addFetchResponse(data);
        StubFetcher.addFetchResponse();

        // Act
        await client.updateDocument(documentUrl, [new RemovePropertyOperation(url)]);

        // Assert
        expect(StubFetcher.fetch).toHaveBeenCalledWith(
            documentUrl,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/sparql-update' },
                body: expect.anything(),
            },
        );

        const body = (StubFetcher.fetch as any).mock.calls[1][1].body;

        await expect(body).toEqualSPARQL(`
            DELETE DATA {
                <#it> <http://xmlns.com/foaf/0.1/name> "Johnathan" .
                <#it> <http://xmlns.com/foaf/0.1/surname> "Doe" .
                <#it> <http://xmlns.com/foaf/0.1/givenName> "John" .
            }
        `);
    });

    it('deletes all properties from a resource within a container document', async () => {
        // Arrange
        const documentUrl = Url.resolve(Faker.internet.url(), Str.slug(Faker.random.word()));
        const metaDocumentUrl = `${documentUrl}.meta`;
        const resourceUrl = `${documentUrl}#it`;
        const data = `
            <${documentUrl}>
                a <http://www.w3.org/ns/ldp#Container>, <https://schema.org/Collection> ;
                <http://www.w3.org/2000/01/rdf-schema#label> "Container name" ;
                <http://purl.org/dc/terms/modified>
                    "2020-03-08T14:33:09Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
            <${resourceUrl}>
                <http://xmlns.com/foaf/0.1/name> "Jonathan" ;
                <http://xmlns.com/foaf/0.1/surname> "Doe" ;
                <http://xmlns.com/foaf/0.1/givenName> "John" .
        `;

        StubFetcher.addFetchResponse(data);
        StubFetcher.addFetchResponse();

        // Act
        await client.updateDocument(documentUrl, [new RemovePropertyOperation(resourceUrl)]);

        // Assert
        expect(StubFetcher.fetch).toHaveBeenCalledWith(metaDocumentUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/sparql-update' },
            body: expect.anything(),
        });

        const body = (StubFetcher.fetch as any).mock.calls[1][1].body;

        await expect(body).toEqualSPARQL(`
            DELETE DATA {
                <${documentUrl}> a <http://www.w3.org/ns/ldp#Container> .
                <${documentUrl}>
                    <http://purl.org/dc/terms/modified>
                    "2020-03-08T14:33:09Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
                <${resourceUrl}> <http://xmlns.com/foaf/0.1/name> "Jonathan" .
                <${resourceUrl}> <http://xmlns.com/foaf/0.1/surname> "Doe" .
                <${resourceUrl}> <http://xmlns.com/foaf/0.1/givenName> "John" .
            }
        `);
    });

    it('fails updating non-existent documents', async () => {
        // Arrange
        const url = Faker.internet.url();
        const data = `<${url}> a <http://xmlns.com/foaf/0.1/Person> .`;

        StubFetcher.addFetchResponse(data);
        StubFetcher.addFetchNotFoundResponse();

        // Act & Assert
        await expect(client.updateDocument(url, [new RemovePropertyOperation(url, 'foobar')]))
            .rejects
            .toThrowError(`Error updating document at ${url}, returned 404 status code`);
    });

    it('ignores empty updates', async () => {
        await client.updateDocument(Faker.internet.url(), []);

        expect(StubFetcher.fetch).not.toHaveBeenCalled();
    });

    it('deletes non-container documents', async () => {
        // Arrange
        const url = Faker.internet.url();
        const data = `
            <${url}>
                a <http://xmlns.com/foaf/0.1/Person> ;
                <http://xmlns.com/foaf/0.1/name> "Foo Bar" .
        `;

        StubFetcher.addFetchResponse(data);
        StubFetcher.addFetchResponse();

        // Act
        await client.deleteDocument(url);

        // Assert
        expect(StubFetcher.fetch).toHaveBeenCalledWith(url, { method: 'DELETE' });
    });

    it('deletes container documents', async () => {
        // Arrange
        const containerUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(Faker.random.word()));
        const documentUrl = Url.resolve(containerUrl, Faker.random.uuid());
        const containerData = `
            <${containerUrl}>
                a <http://www.w3.org/ns/ldp#Container> ;
                <http://www.w3.org/ns/ldp#contains> <${documentUrl}> .
        `;
        const documentData = `
            <${documentUrl}>
                a <http://xmlns.com/foaf/0.1/Person> .
        `;

        StubFetcher.addFetchResponse(containerData);

        // TODO this one is not necessary, but the current implementation is not optimal
        StubFetcher.addFetchResponse(containerData);

        StubFetcher.addFetchResponse(documentData);

        // TODO this one is not necessary, but the current implementation is not optimal
        StubFetcher.addFetchResponse(documentData);

        StubFetcher.addFetchResponse();
        StubFetcher.addFetchResponse();

        // Act
        await client.deleteDocument(containerUrl);

        // Assert
        expect(StubFetcher.fetch).toHaveBeenCalledTimes(6);
        expect(StubFetcher.fetch).toHaveBeenNthCalledWith(1, containerUrl, { headers: { Accept: 'text/turtle' } });
        expect(StubFetcher.fetch).toHaveBeenNthCalledWith(2, containerUrl, { headers: { Accept: 'text/turtle' } });
        expect(StubFetcher.fetch)
            .toHaveBeenNthCalledWith(3, containerUrl + '*', { headers: { Accept: 'text/turtle' } });
        expect(StubFetcher.fetch).toHaveBeenNthCalledWith(4, documentUrl, { headers: { Accept: 'text/turtle' } });
        expect(StubFetcher.fetch).toHaveBeenNthCalledWith(5, documentUrl, { method: 'DELETE' });
        expect(StubFetcher.fetch).toHaveBeenNthCalledWith(6, containerUrl, { method: 'DELETE' });
    });

    it('checks if a document exists', async () => {
        // Arrange
        const url = Faker.internet.url();

        StubFetcher.addFetchResponse(`<${url}> a <http://xmlns.com/foaf/0.1/Person> .`);

        // Act
        const exists = await client.documentExists(url);

        // Assert
        expect(exists).toBe(true);
    });

    it('checks if a document does not exist', async () => {
        // Arrange
        const url = Faker.internet.url();

        StubFetcher.addFetchNotFoundResponse();

        // Act
        const exists = await client.documentExists(url);

        // Assert
        expect(exists).toBe(false);
    });

    it('handles malformed document errors', async () => {
        // Arrange
        let error;
        const url = Faker.internet.url();

        StubFetcher.addFetchResponse('this is not turtle');

        // Act
        try {
            await client.getDocument(url);
        } catch (e) {
            error = e;
        }

        // Assert
        expect(error).toBeInstanceOf(MalformedDocumentError);
        expect(error.message).toEqual(`Malformed RDF document found at ${url} - Unexpected "this" on line 1.`);
    });

    it('handles malformed document errors reading containers', async () => {
        // Arrange
        let error;
        const containerUrl = Url.resolveDirectory(
            Faker.internet.url(),
            Str.slug(Faker.random.word()),
        );

        StubFetcher.addFetchResponse('this is not turtle');

        // Act
        try {
            await client.getDocuments(containerUrl);
        } catch (e) {
            error = e;
        }

        // Assert
        expect(error).toBeInstanceOf(MalformedDocumentError);
        expect(error.message).toEqual(`Malformed RDF document found at ${containerUrl} - Unexpected "this" on line 1.`);
    });

});
