import Faker from 'faker';

import Arr from '@/utils/Arr';
import Solid from '@/utils/Solid';
import Str from '@/utils/Str';

import $rdf from '@mocks/rdflib';
import SolidAuthClient from '@mocks/solid-auth-client';

describe('Solid', () => {

    it('creates containers', async () => {
        const baseUrl = Faker.internet.url();
        const containerUrl = baseUrl + '/' + Str.slug(Faker.random.word());
        const name = Faker.random.word();
        const location = '/' + Str.slug(Faker.random.word());
        const types = Arr
            .make(Faker.random.number({min: 2, max: 4}))
            .map(() => Faker.random.word());

        $rdf.__addWebOperationResult({ Location: location });

        const id = Faker.random.uuid();
        const container = await Solid.createContainer(containerUrl, id, name, types);

        expect(container.url).toBe(baseUrl + location);
        expect(container.name).toBe(name);
        expect(container.types).toBe(types);
        // TODO validate graph

        expect($rdf.Fetcher).toHaveBeenCalledTimes(1);

        const FetcherMock = $rdf.Fetcher.mock.instances[0];

        expect(FetcherMock.webOperation).toHaveBeenCalledWith(
            'POST',
            containerUrl,
            // TODO validate body
            expect.anything()
        );
    });

    it('fetches resources using a trailing slash', async () => {
        const containerUrl = Faker.internet.url() + '/' + Str.slug(Faker.random.word());
        const data = `<foobar> <http://cmlns.com/foaf/0.1/name> "Foo Bar" .`;

        SolidAuthClient.addFetchResponse(data);

        const resources = await Solid.getResources(containerUrl, []);

        expect(resources).toHaveLength(1);

        expect(resources[0].url).toEqual(containerUrl + '/foobar');
        expect(resources[0].name).toEqual('Foo Bar');
        expect(resources[0].types).toEqual([]);

        expect($rdf.parse).toHaveBeenCalledWith(
            data,
            expect.anything(),
            containerUrl + '/',
            'text/turtle',
            null
        );
    });

    it('fetches containers using a trailing slash', async () => {
        const containerUrl = Faker.internet.url() + '/' + Str.slug(Faker.random.word());
        const containerData = `<foobar> a <http://www.w3.org/ns/ldp#BasicContainer> .`;
        const resourceData =
            `<foobar>
                a <http://www.w3.org/ns/ldp#BasicContainer> ;
                <http://cmlns.com/foaf/0.1/name> "Foo Bar" .`;

        SolidAuthClient.addFetchResponse(containerData);
        SolidAuthClient.addFetchResponse(resourceData);

        const containers = await Solid.getContainers(containerUrl, []);

        expect(containers).toHaveLength(1);

        expect(containers[0].url).toEqual(containerUrl + '/foobar');
        expect(containers[0].name).toEqual('Foo Bar');
        expect(containers[0].types).toEqual(['http://www.w3.org/ns/ldp#BasicContainer']);

        expect($rdf.parse).toHaveBeenCalledWith(
            containerData,
            expect.anything(),
            containerUrl + '/',
            'text/turtle',
            null
        );
        expect($rdf.parse).toHaveBeenCalledWith(
            resourceData,
            expect.anything(),
            containerUrl + '/foobar',
            'text/turtle',
            null
        );
    });

});
