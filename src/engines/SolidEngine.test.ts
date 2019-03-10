jest.mock('@/solid');

import Soukai, { Model } from 'soukai';

import Faker from 'faker';

import Person from '@tests/stubs/Person';

import SolidEngine from '@/engines/SolidEngine';

import Solid, { ResourceProperty } from '@/solid';

import Url from '@/utils/Url';

let engine: SolidEngine;

describe('SolidEngine', () => {

    beforeAll(() => {
        Soukai.loadModel('Person', Person);

        engine = new SolidEngine();
    });

    it ('fails when using non-solid models', () => {
        class MyModel extends Model {}

        Soukai.loadModel('MyModel', MyModel);

        const operations = [
            engine.create(MyModel as any, {}),
            engine.readMany(MyModel as any),
            engine.readOne(MyModel as any, Faker.random.uuid()),
        ];

        for (const operation of operations) {
            expect(operation).rejects.toThrow(Error);
            expect(operation).rejects.toThrow('SolidEngine only supports querying SolidModel models');
        }
    });

    it('creates one resource', async () => {
        const resourceUrl = Url.resolve(Faker.internet.url(), Faker.random.uuid());
        const name = Faker.name.firstName();

        const newModelId = await engine.create(Person, {
            id: resourceUrl,
            name,
        });

        expect(newModelId).toEqual(resourceUrl);

        expect(Solid.createResource).toHaveBeenCalledWith(
            resourceUrl,

            // TODO test body using argument matcher
            expect.anything(),
        );
    });

    it('gets one resource', async () => {
        const resourceUrl = Url.resolve(Faker.internet.url(), Faker.random.uuid());
        const name = Faker.name.firstName();

        await Solid.createResource(resourceUrl, [
            ResourceProperty.literal('http://cmlns.com/foaf/0.1/name', name),
        ]);

        const document = await engine.readOne(Person, resourceUrl);

        expect(document).toEqual({ id: resourceUrl, name });

        expect(Solid.getResource).toHaveBeenCalledWith(resourceUrl);
    });

    it('gets many resources', async () => {
        const containerUrl = Faker.internet.url();
        const firstUrl = Url.resolve(containerUrl, 'first');
        const secondUrl = Url.resolve(containerUrl, 'second');
        const firstName = Faker.name.firstName();
        const secondName = Faker.name.firstName();

        await Solid.createResource(firstUrl, [
            ResourceProperty.type('http://cmlns.com/foaf/0.1/Person'),
            ResourceProperty.literal('http://cmlns.com/foaf/0.1/name', firstName),
        ]);

        await Solid.createResource(secondUrl, [
            ResourceProperty.type('http://cmlns.com/foaf/0.1/Person'),
            ResourceProperty.literal('http://cmlns.com/foaf/0.1/name', secondName),
        ]);

        Person.from(containerUrl);

        const documents = await engine.readMany(Person);

        expect(documents).toHaveLength(2);
        expect(documents[0]).toEqual({ id: firstUrl, name: firstName });
        expect(documents[1]).toEqual({ id: secondUrl, name: secondName });

        expect(Solid.getResources).toHaveBeenCalledWith(
            containerUrl,
            ['http://cmlns.com/foaf/0.1/Person'],
        );
    });

});
