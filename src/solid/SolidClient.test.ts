import Faker from 'faker';

import Str from '@/utils/Str';
import Url from '@/utils/Url';

import { SolidClient, ResourceProperty, Resource } from '@/solid';

import StubFetcher from '@tests/stubs/StubFetcher';

describe('Solid', () => {

    let client: SolidClient;

    beforeEach(() => {
        StubFetcher.reset();
        client = new SolidClient(StubFetcher.fetch.bind(StubFetcher));
    });

    it('creates resources', async () => {
        const parentUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(Faker.random.word()));
        const resourceUrl = Url.resolve(parentUrl, Faker.random.uuid());
        const name = Faker.random.word();
        const firstType = Url.resolve(Faker.internet.url(), Str.slug(Faker.random.word()));
        const secondType = Url.resolve(Faker.internet.url(), Str.slug(Faker.random.word()));

        StubFetcher.addFetchNotFoundResponse();
        StubFetcher.addFetchResponse();

        const resource = await client.createResource(
            parentUrl,
            resourceUrl,
            [
                ResourceProperty.literal('http://cmlns.com/foaf/0.1/name', name),
                ResourceProperty.type(firstType),
                ResourceProperty.type(secondType),
                ResourceProperty.type('http://www.w3.org/ns/ldp#Resource'),
            ],
        );

        expect(resource.url).toEqual(resourceUrl);
        expect(resource.name).toEqual(name);
        expect(resource.types).toEqual([
            firstType,
            secondType,
            'http://www.w3.org/ns/ldp#Resource',
        ]);

        expect(StubFetcher.fetch).toHaveBeenCalledWith(
            resourceUrl,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'text/turtle' },

                // TODO test body using argument matcher
                body: expect.anything(),
            },
        );
    });

    it('creates resources without minted url', async () => {
        const parentUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(Faker.random.word()));
        const resourceUrl = Url.resolve(parentUrl, Faker.random.uuid());

        StubFetcher.addFetchResponse('', { Location: resourceUrl });

        const resource = await client.createResource(
            parentUrl,
            null,
            [
                ResourceProperty.type('http://www.w3.org/ns/ldp#Resource'),
            ],
        );

        expect(resource.url).toEqual(resourceUrl);

        expect(StubFetcher.fetch).toHaveBeenCalledWith(
            parentUrl,
            {
                method: 'POST',
                headers: { 'Content-Type': 'text/turtle' },

                // TODO test body using argument matcher
                body: expect.anything(),
            },
        );
    });

    it('fails creating resources if the provided url is already in use', async () => {
        const parentUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(Faker.random.word()));
        const resourceUrl = Url.resolve(parentUrl, Faker.random.uuid());

        StubFetcher.addFetchResponse();

        await expect(client.createResource(parentUrl, resourceUrl, []))
            .rejects
            .toThrowError(`Cannot create a resource at ${resourceUrl}, url already in use`);
    });

    it('creates containers', async () => {
        const name = Faker.random.word();
        const parentUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(Faker.random.word()));
        const containerUrl = Url.resolveDirectory(parentUrl, Str.slug(name));

        StubFetcher.addFetchNotFoundResponse();
        StubFetcher.addFetchResponse();

        const resource = await client.createContainer(
            parentUrl,
            containerUrl,
            [
                ResourceProperty.literal('http://cmlns.com/foaf/0.1/name', name),
                ResourceProperty.type('http://www.w3.org/ns/ldp#Resource'),
                ResourceProperty.type('http://www.w3.org/ns/ldp#Container'),
            ],
        );

        expect(resource.url).toEqual(containerUrl);
        expect(resource.name).toEqual(name);
        expect(resource.types).toEqual([
            'http://www.w3.org/ns/ldp#Resource',
            'http://www.w3.org/ns/ldp#Container',
        ]);

        expect(StubFetcher.fetch).toHaveBeenCalledWith(
            parentUrl,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/turtle',
                    'Link': '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',
                    'Slug': Str.slug(name),
                },

                // TODO test body using argument matcher
                body: expect.anything(),
            },
        );
    });

    it('creates containers without minted url', async () => {
        const parentUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(Faker.random.word()));
        const containerUrl = Url.resolveDirectory(parentUrl, Str.slug(name));

        StubFetcher.addFetchResponse('', { Location: containerUrl });

        const resource = await client.createContainer(
            parentUrl,
            null,
            [
                ResourceProperty.type('http://www.w3.org/ns/ldp#Resource'),
                ResourceProperty.type('http://www.w3.org/ns/ldp#Container'),
            ],
        );

        expect(resource.url).toEqual(containerUrl);

        expect(StubFetcher.fetch).toHaveBeenCalledWith(
            parentUrl,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/turtle',
                    'Link': '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',
                },

                // TODO test body using argument matcher
                body: expect.anything(),
            },
        );
    });

    it('gets one resource', async () => {
        const url = Faker.internet.url();
        const data = `
            <${url}>
                a <http://www.w3.org/ns/ldp#Resource> ;
                <http://cmlns.com/foaf/0.1/name> "Foo Bar" .
        `;

        StubFetcher.addFetchResponse(data);

        const resource = await client.getResource(url) as Resource;

        expect(resource).not.toBeNull();
        expect(resource.name).toEqual('Foo Bar');

        expect(StubFetcher.fetch).toHaveBeenCalledWith(url, {
            headers: { 'Accept': 'text/turtle' },
        });
    });

    it('getting non-existent resource returns null', async () => {
        StubFetcher.addFetchNotFoundResponse();

        const resource = await client.getResource(Faker.internet.url());

        expect(resource).toBeNull();
    });

    it('gets resources using a trailing slash', async () => {
        const containerUrl = Url.resolve(Faker.internet.url(), Str.slug(Faker.random.word()));
        const data = `
            <foobar>
                a <http://www.w3.org/ns/ldp#Resource> ;
                <http://cmlns.com/foaf/0.1/name> "Foo Bar" .
        `;

        StubFetcher.addFetchResponse(data);

        const resources = await client.getResources(containerUrl);

        expect(resources).toHaveLength(1);

        expect(resources[0].url).toEqual(containerUrl + '/foobar');
        expect(resources[0].name).toEqual('Foo Bar');
        expect(resources[0].types).toEqual(['http://www.w3.org/ns/ldp#Resource']);

        expect(StubFetcher.fetch).toHaveBeenCalledWith(containerUrl + '/*', {
            headers: { 'Accept': 'text/turtle' },
        });
    });

    it('getting resources ignores all documents that are not resources', async () => {
        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const data = `
            <foo> <http://cmlns.com/foaf/0.1/name> "Foo" .
            <bar> a <http://www.w3.org/ns/ldp#Resource> .
        `;

        StubFetcher.addFetchResponse(data);

        const resources = await client.getResources(containerUrl);

        expect(resources).toHaveLength(1);
        expect(resources[0].url).toEqual(Url.resolve(containerUrl, 'bar'));
    });

    it('getting resources they only contain their own properties', async () => {
        const data = `
            <foo>
                a <http://www.w3.org/ns/ldp#Resource> ;
                <http://cmlns.com/foaf/0.1/name> "Foo" .
            <bar>
                a <http://www.w3.org/ns/ldp#Resource> ;
                <http://cmlns.com/foaf/0.1/name> "Bar" .
        `;

        StubFetcher.addFetchResponse(data);

        const resources = await client.getResources(Faker.internet.url());

        expect(resources).toHaveLength(2);

        const fooProperties = resources[0].getProperties();
        expect(Object.values(fooProperties)).toHaveLength(2);
        expect(fooProperties['http://www.w3.org/1999/02/22-rdf-syntax-ns#type'])
            .toEqual('http://www.w3.org/ns/ldp#Resource');
        expect(fooProperties['http://cmlns.com/foaf/0.1/name'])
            .toEqual('Foo');

        const barProperties = resources[1].getProperties();
        expect(Object.values(barProperties)).toHaveLength(2);
        expect(barProperties['http://www.w3.org/1999/02/22-rdf-syntax-ns#type'])
            .toEqual('http://www.w3.org/ns/ldp#Resource');
        expect(barProperties['http://cmlns.com/foaf/0.1/name'])
            .toEqual('Bar');
    });

    it('gets resources filtered by type', async () => {
        const firstType = Url.resolve(Faker.internet.url(), Str.slug(Faker.random.word()));
        const secondType = Url.resolve(Faker.internet.url(), Str.slug(Faker.random.word()));

        const data = `
            <foo>
                a <http://www.w3.org/ns/ldp#Resource> ;
                a <${encodeURI(firstType)}> ;
                <http://cmlns.com/foaf/0.1/name> "Foo" .
            <bar>
                a <http://www.w3.org/ns/ldp#Resource> ;
                a <${encodeURI(secondType)}> ;
                <http://cmlns.com/foaf/0.1/name> "Bar" .
        `;

        StubFetcher.addFetchResponse(data);

        const resources = await client.getResources(Faker.internet.url(), [firstType]);

        expect(resources).toHaveLength(1);
        expect(resources[0].name).toEqual('Foo');
    });

    it('getting container resources does not use globbing', async () => {
        const containerUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(Faker.random.word()));
        const type = Url.resolve(Faker.internet.url(), Str.slug(Faker.random.word()));

        StubFetcher.addFetchResponse(`
            <>
                <http://www.w3.org/ns/ldp#contains> <foo>, <bar>, <baz> .
            <foo>
                a <http://www.w3.org/ns/ldp#Resource>, <http://www.w3.org/ns/ldp#Container> .
            <bar>
                a <http://www.w3.org/ns/ldp#Resource>, <http://www.w3.org/ns/ldp#Container> .
            <baz>
                a <http://www.w3.org/ns/ldp#Resource> .
        `);
        StubFetcher.addFetchResponse(`
            <${containerUrl}foo>
                a <http://www.w3.org/ns/ldp#Resource>, <http://www.w3.org/ns/ldp#Container>, <${type}> ;
                <http://cmlns.com/foaf/0.1/name> "Foo" .
        `);
        StubFetcher.addFetchResponse(`
            <${containerUrl}bar>
                a <http://www.w3.org/ns/ldp#Resource>, <http://www.w3.org/ns/ldp#Container> ;
                <http://cmlns.com/foaf/0.1/name> "Bar" .
        `);

        const resources = await client.getResources(containerUrl, [
            'http://www.w3.org/ns/ldp#Container',
            type,
        ]);

        expect(resources).toHaveLength(1);

        expect(resources[0].url).toEqual(containerUrl + 'foo');
        expect(resources[0].name).toEqual('Foo');
        expect(resources[0].types).toEqual([
            'http://www.w3.org/ns/ldp#Resource',
            'http://www.w3.org/ns/ldp#Container',
            type,
        ]);

        expect(StubFetcher.fetch).toHaveBeenCalledWith(containerUrl, {
            headers: { 'Accept': 'text/turtle' },
        });
        expect(StubFetcher.fetch).toHaveBeenCalledWith(containerUrl + 'foo', {
            headers: { 'Accept': 'text/turtle' },
        });
        expect(StubFetcher.fetch).toHaveBeenCalledWith(containerUrl + 'bar', {
            headers: { 'Accept': 'text/turtle' },
        });
        expect(StubFetcher.fetch).not.toHaveBeenCalledWith(containerUrl + 'baz', {
            headers: { 'Accept': 'text/turtle' },
        });
    });

    it('updates resources', async () => {
        const url = Faker.internet.url();
        const updatedProperties = [
            ResourceProperty.type('Type'),
            ResourceProperty.literal('literalName', 'literalValue'),
        ];
        const deletedProperties = [
            'deletedOne',
            'deletedTwo',
        ];

        StubFetcher.addFetchResponse();

        await client.updateResource(url, updatedProperties, deletedProperties);

        expect(StubFetcher.fetch).toHaveBeenCalledWith(
            url,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'text/n3' },

                // TODO test body using argument matcher
                body: expect.anything(),
            }
        );
    });

    it('fails updating non-existent resources', async () => {
        const url = Faker.internet.url();

        StubFetcher.addFetchNotFoundResponse();

        await expect(client.updateResource(url, [], []))
            .rejects
            .toThrowError(`Error updating resource at ${url}, returned status code 404`);
    });

});