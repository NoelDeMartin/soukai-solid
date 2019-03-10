import Faker from 'faker';

import Str from '@/utils/Str';
import Url from '@/utils/Url';

import Solid, { ResourceProperty, Resource } from '@/solid';

import SolidAuthClient from '@mocks/solid-auth-client';

describe('Solid', () => {

    it('creates resources', async () => {
        const url = Url.resolve(Faker.internet.url(), Faker.random.uuid());
        const name = Faker.random.word();
        const firstType = Url.resolve(Faker.internet.url(), Faker.random.word());
        const secondType = Url.resolve(Faker.internet.url(), Faker.random.word());

        SolidAuthClient.addFetchNotFoundResponse();
        SolidAuthClient.addFetchResponse();

        const resource = await Solid.createResource(
            url,
            [
                ResourceProperty.literal('http://cmlns.com/foaf/0.1/name', name),
                ResourceProperty.type(firstType),
                ResourceProperty.type(secondType),
                ResourceProperty.type('http://www.w3.org/ns/ldp#Resource'),
            ],
        );

        expect(resource.url).toEqual(url);
        expect(resource.name).toEqual(name);
        expect(resource.types).toEqual([
            firstType,
            secondType,
            'http://www.w3.org/ns/ldp#Resource',
        ]);

        expect(SolidAuthClient.fetch).toHaveBeenCalledWith(
            url,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'text/turtle',
                },

                // TODO test body using argument matcher
                body: expect.anything(),
            },
        );
    });

    it('adds ldp:Resource type to new resources', async () => {
        SolidAuthClient.addFetchNotFoundResponse();
        SolidAuthClient.addFetchResponse();

        const resource = await Solid.createResource(
            Url.resolve(Faker.internet.url(), Faker.random.uuid())
        );

        expect(resource.types).toEqual(['http://www.w3.org/ns/ldp#Resource']);
    });

    it('fails creating resources if the provided url is already in use', async () => {
        const url = Faker.internet.url();

        SolidAuthClient.addFetchResponse();

        await expect(Solid.createResource(url, []))
            .rejects
            .toThrowError(`Cannot create a resource at ${url}, url already in use`);
    });

    it('gets one resource', async () => {
        const url = Faker.internet.url();
        const data = `
            <${url}>
                a <http://www.w3.org/ns/ldp#Resource> ;
                <http://cmlns.com/foaf/0.1/name> "Foo Bar" .
        `;

        SolidAuthClient.addFetchResponse(data);

        const resource = await Solid.getResource(url) as Resource;

        expect(resource).not.toBeNull();
        expect(resource.name).toEqual('Foo Bar');

        expect(SolidAuthClient.fetch).toHaveBeenCalledWith(url);
    });

    it('getting non-existent resource returns null', async () => {
        SolidAuthClient.addFetchNotFoundResponse();

        const resource = await Solid.getResource(Faker.internet.url());

        expect(resource).toBeNull();
    });

    it('gets resources using a trailing slash', async () => {
        const containerUrl = Url.resolve(Faker.internet.url(), Str.slug(Faker.random.word()));
        const data = `
            <foobar>
                a <http://www.w3.org/ns/ldp#Resource> ;
                <http://cmlns.com/foaf/0.1/name> "Foo Bar" .
        `;

        SolidAuthClient.addFetchResponse(data);

        const resources = await Solid.getResources(containerUrl);

        expect(resources).toHaveLength(1);

        expect(resources[0].url).toEqual(containerUrl + '/foobar');
        expect(resources[0].name).toEqual('Foo Bar');
        expect(resources[0].types).toEqual(['http://www.w3.org/ns/ldp#Resource']);

        expect(SolidAuthClient.fetch).toHaveBeenCalledWith(containerUrl + '/*');
    });

    it('getting resources ignores all documents that are not resources', async () => {
        const containerUrl = Faker.internet.url();
        const data = `
            <foo> <http://cmlns.com/foaf/0.1/name> "Foo" .
            <bar> a <http://www.w3.org/ns/ldp#Resource> .
        `;

        SolidAuthClient.addFetchResponse(data);

        const resources = await Solid.getResources(containerUrl);

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

        SolidAuthClient.addFetchResponse(data);

        const resources = await Solid.getResources(Faker.internet.url());

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
        const firstType = Url.resolve(Faker.internet.url(), Faker.random.word());
        const secondType = Url.resolve(Faker.internet.url(), Faker.random.word());

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

        SolidAuthClient.addFetchResponse(data);

        const resources = await Solid.getResources(Faker.internet.url(), [firstType]);

        expect(resources).toHaveLength(1);
        expect(resources[0].name).toEqual('Foo');
    });

});
