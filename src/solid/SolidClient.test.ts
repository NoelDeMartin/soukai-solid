import Faker from 'faker';

import { MalformedDocumentError } from '@/errors/MalformedDocumentError';

import Str from '@/utils/Str';
import Url from '@/utils/Url';

import { IRI } from '@/solid/utils/RDF';
import RDFDocument from '@/solid/RDFDocument';
import RDFResourceProperty, { RDFResourcePropertyType } from '@/solid/RDFResourceProperty';
import SolidClient from '@/solid/SolidClient';

import StubFetcher from '@tests/stubs/StubFetcher';

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
        const name = Faker.random.word();
        const firstType = Url.resolve(Faker.internet.url(), Str.slug(Faker.random.word()));
        const secondType = Url.resolve(Faker.internet.url(), Str.slug(Faker.random.word()));

        StubFetcher.addFetchNotFoundResponse();
        StubFetcher.addFetchResponse();

        // Act
        const document = await client.createDocument(
            parentUrl,
            documentUrl,
            [
                RDFResourceProperty.literal(documentUrl, IRI('foaf:name'), name),
                RDFResourceProperty.type(documentUrl, firstType),
                RDFResourceProperty.type(documentUrl, secondType),
            ],
        );

        // Assert
        expect(document.url).toEqual(documentUrl);
        expect(document.rootResource.url).toEqual(documentUrl);
        expect(document.rootResource.name).toEqual(name);
        expect(document.rootResource.types).toEqual([
            firstType,
            secondType,
        ]);

        expect(StubFetcher.fetch).toHaveBeenCalledWith(
            documentUrl,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'text/turtle' },
                body: [
                    `<${documentUrl}> <http://xmlns.com/foaf/0.1/name> "${name}" .`,
                    `<${documentUrl}> a <${firstType}> .`,
                    `<${documentUrl}> a <${secondType}> .`,
                ].join('\n'),
            },
        );
    });

    it('creates documents without minted url', async () => {
        // Arrange
        const parentUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(Faker.random.word()));
        const documentUrl = Url.resolve(parentUrl, Faker.random.uuid());

        StubFetcher.addFetchResponse('', { Location: documentUrl });

        // Act
        const document = await client.createDocument(
            parentUrl,
            null,
            [
                RDFResourceProperty.type(null, IRI('foaf:Person')),
            ],
        );

        // Assert
        expect(document.url).toEqual(documentUrl);

        expect(StubFetcher.fetch).toHaveBeenCalledWith(
            parentUrl,
            {
                method: 'POST',
                headers: { 'Content-Type': 'text/turtle' },
                body: '<> a <http://xmlns.com/foaf/0.1/Person> .',
            },
        );
    });

    it('creates container documents', async () => {
        // Arrange
        const name = Faker.random.word();
        const parentUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(Faker.random.word()));
        const containerUrl = Url.resolveDirectory(parentUrl, Str.slug(name));

        StubFetcher.addFetchNotFoundResponse();
        StubFetcher.addFetchResponse();

        // Act
        const document = await client.createDocument(
            parentUrl,
            containerUrl,
            [
                RDFResourceProperty.literal(containerUrl, IRI('foaf:name'), name),
                RDFResourceProperty.type(containerUrl, IRI('ldp:Container')),
            ],
        );

        // Assert
        expect(document.url).toEqual(containerUrl);
        expect(document.rootResource.url).toEqual(containerUrl);
        expect(document.rootResource.name).toEqual(name);
        expect(document.rootResource.types).toEqual([IRI('ldp:Container')]);

        expect(StubFetcher.fetch).toHaveBeenCalledWith(
            parentUrl,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/turtle',
                    'Link': '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',
                    'Slug': Str.slug(name),
                },
                body: [
                    `<${containerUrl}> <http://xmlns.com/foaf/0.1/name> "${name}" .`,
                    `<${containerUrl}> a <http://www.w3.org/ns/ldp#Container> .`,
                ].join('\n'),
            },
        );
    });

    it('creates container documents without minted url', async () => {
        // Arrange
        const parentUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(Faker.random.word()));
        const containerUrl = Url.resolveDirectory(parentUrl, Str.slug(name));

        StubFetcher.addFetchResponse('', { Location: containerUrl });

        // Act
        const document = await client.createDocument(
            parentUrl,
            null,
            [
                RDFResourceProperty.type(null, IRI('ldp:Container')),
            ],
        );

        // Assert
        expect(document.url).toEqual(containerUrl);
        expect(document.rootResource.url).toEqual(containerUrl);

        expect(StubFetcher.fetch).toHaveBeenCalledWith(
            parentUrl,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/turtle',
                    'Link': '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',
                },
                body: [
                    `<> a <http://www.w3.org/ns/ldp#Container> .`,
                ].join('\n'),
            },
        );
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
        expect(document.rootResource.name).toEqual('Foo Bar');

        expect(StubFetcher.fetch).toHaveBeenCalledWith(url, {
            headers: { 'Accept': 'text/turtle' },
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
        expect(documents[0].rootResource.url).toEqual(containerUrl + 'foobar');
        expect(documents[0].rootResource.name).toEqual('Foo Bar');
        expect(documents[0].rootResource.types).toEqual([IRI('foaf:Person')]);

        expect(StubFetcher.fetch).toHaveBeenCalledWith(containerUrl + '*', {
            headers: { 'Accept': 'text/turtle' },
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
        expect(documents[1].rootResource.url).toEqual(`${containerUrl}/bar`);
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
        expect(documents[0].rootResource.url).toEqual(`${containerUrl}foo`);
        expect(documents[0].rootResource.name).toEqual('Foo');
        expect(documents[0].rootResource.types).toEqual([
            IRI('ldp:Container'),
            type,
        ]);

        expect(documents[1].url).toEqual(`${containerUrl}bar`);
        expect(documents[1].rootResource.url).toEqual(`${containerUrl}bar`);
        expect(documents[1].rootResource.name).toEqual('Bar');
        expect(documents[1].rootResource.types).toEqual([IRI('ldp:Container')]);

        expect(StubFetcher.fetch).toHaveBeenCalledWith(containerUrl, {
            headers: { 'Accept': 'text/turtle' },
        });
        expect(StubFetcher.fetch).toHaveBeenCalledWith(`${containerUrl}foo`, {
            headers: { 'Accept': 'text/turtle' },
        });
        expect(StubFetcher.fetch).toHaveBeenCalledWith(`${containerUrl}bar`, {
            headers: { 'Accept': 'text/turtle' },
        });
    });

    it('updates documents', async () => {
        // Arrange
        const url = Faker.internet.url();
        const data = `
            <${url}>
                <http://xmlns.com/foaf/0.1/name> "Johnathan" ;
                <http://xmlns.com/foaf/0.1/surname> "Doe" ;
                <http://xmlns.com/foaf/0.1/givenName> "John" .
        `;
        const updatedProperties = [
            RDFResourceProperty.literal(url, 'http://xmlns.com/foaf/0.1/name', 'John Doe'),
        ];
        const deletedProperties = [
            [url, 'http://xmlns.com/foaf/0.1/surname'],
            [url, 'http://xmlns.com/foaf/0.1/givenName'],
        ] as [string, string][];

        StubFetcher.addFetchResponse(data);
        StubFetcher.addFetchResponse();

        // Act
        await client.updateDocument(url, updatedProperties, deletedProperties);

        // Assert
        expect(StubFetcher.fetch).toHaveBeenCalledWith(
            url,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'text/n3' },
                body: expect.anything(),
            }
        );

        const body = (StubFetcher.fetch as any).mock.calls[1][1].body;

        await expect(body).toEqualTurtle(`
            @prefix solid: <http://www.w3.org/ns/solid/terms#> .
            <> solid:patches <${url}> ;
                solid:inserts {
                    <${url}> <http://xmlns.com/foaf/0.1/name> "John Doe" .
                } ;
                solid:where {
                    <${url}> <http://xmlns.com/foaf/0.1/surname> ?d0 .
                    <${url}> <http://xmlns.com/foaf/0.1/givenName> ?d1 .
                    <${url}> <http://xmlns.com/foaf/0.1/name> ?d2 .
                } ;
                solid:deletes {
                    <${url}> <http://xmlns.com/foaf/0.1/surname> ?d0 .
                    <${url}> <http://xmlns.com/foaf/0.1/givenName> ?d1 .
                    <${url}> <http://xmlns.com/foaf/0.1/name> ?d2 .
                } .
        `, { format: 'text/n3' });
    });

    it('updates container documents', async () => {
        // Arrange
        const url = Url.resolve(Faker.internet.url(), Str.slug(Faker.random.word()));
        const data = `
            <${url}>
                a <http://www.w3.org/ns/ldp#Container> ;
                <http://xmlns.com/foaf/0.1/name> "Jonathan" ;
                <http://xmlns.com/foaf/0.1/surname> "Doe" ;
                <http://xmlns.com/foaf/0.1/givenName> "John" .
        `;
        const updatedProperties = [
            RDFResourceProperty.literal(url, 'http://xmlns.com/foaf/0.1/name', 'John Doe'),
        ];
        const deletedProperties = [
            [url, 'http://xmlns.com/foaf/0.1/surname'],
            [url, 'http://xmlns.com/foaf/0.1/givenName'],
        ] as [string, string][];

        StubFetcher.addFetchResponse(data);
        StubFetcher.addFetchResponse('', {}, 201);

        // Act
        await client.updateDocument(url, updatedProperties, deletedProperties);

        // Assert
        expect(StubFetcher.fetch).toHaveBeenCalledWith(
            url + '.meta',
            {
                method: 'PUT',
                headers: { 'Content-Type': 'text/turtle' },
                body: expect.anything(),
            }
        );

        const body = (StubFetcher.fetch as any).mock.calls[1][1].body;

        await expect(body).toEqualTurtle(`
            <${url}>
                a <http://www.w3.org/ns/ldp#Container> ;
                <http://xmlns.com/foaf/0.1/name> "John Doe" .
        `);
    });

    it('adds new properties when updating', async () => {
        // Arrange
        const url = Faker.internet.url();
        const data = `<${url}> a <http://xmlns.com/foaf/0.1/Person> .`;
        const updatedProperties = [
            RDFResourceProperty.literal(url, 'http://xmlns.com/foaf/0.1/name', 'John Doe'),
        ];

        StubFetcher.addFetchResponse(data);
        StubFetcher.addFetchResponse();

        // Act
        await client.updateDocument(url, updatedProperties, []);

        // Assert
        expect(StubFetcher.fetch).toHaveBeenCalledWith(
            url,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'text/n3' },
                body: expect.anything(),
            }
        );

        const body = (StubFetcher.fetch as any).mock.calls[1][1].body;

        await expect(body).toEqualTurtle(`
            @prefix solid: <http://www.w3.org/ns/solid/terms#> .
            <> solid:patches <${url}> ;
                solid:inserts {
                    <${url}> <http://xmlns.com/foaf/0.1/name> "John Doe" .
                } .
        `, { format: 'text/n3' });
    });

    it('fails updating non-existent documents', async () => {
        // Arrange
        const url = Faker.internet.url();
        const data = `<${url}> a <http://xmlns.com/foaf/0.1/Person> .`;

        StubFetcher.addFetchResponse(data);
        StubFetcher.addFetchNotFoundResponse();

        // Act & Assert
        await expect(client.updateDocument(url, [], [[url, 'foobar']]))
            .rejects
            .toThrowError(`Error updating document at ${url}, returned status code 404`);
    });

    it('ignores empty updates', async () => {
        await client.updateDocument(Faker.internet.url(), [], []);

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
        const containerUrl = 'http://example.com/container/'; // Url.resolveDirectory(Faker.internet.url(), Str.slug(Faker.random.word()));
        const documentUrl = 'http://example.com/container/document'; // Url.resolve(containerUrl, Faker.random.uuid());
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
        StubFetcher.addFetchResponse(containerData); // TODO this one is technically not necessary
        StubFetcher.addFetchResponse(documentData);
        StubFetcher.addFetchResponse(documentData); // TODO this one is technically not necessary
        StubFetcher.addFetchResponse();
        StubFetcher.addFetchResponse();

        // Act
        await client.deleteDocument(containerUrl);

        // Assert
        expect(StubFetcher.fetch).toHaveBeenCalledTimes(6);
        expect(StubFetcher.fetch).toHaveBeenNthCalledWith(1, containerUrl, { headers: { 'Accept': 'text/turtle' } });
        expect(StubFetcher.fetch).toHaveBeenNthCalledWith(2, containerUrl, { headers: { 'Accept': 'text/turtle' } });
        expect(StubFetcher.fetch).toHaveBeenNthCalledWith(3, containerUrl + '*', { headers: { 'Accept': 'text/turtle' } });
        expect(StubFetcher.fetch).toHaveBeenNthCalledWith(4, documentUrl, { headers: { 'Accept': 'text/turtle' } });
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
