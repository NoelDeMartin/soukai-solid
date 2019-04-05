jest.mock('@/solid');

import Soukai, { Model, DocumentNotFound, SoukaiError } from 'soukai';

import Faker from 'faker';

import Group from '@tests/stubs/Group';
import Person from '@tests/stubs/Person';

import SolidEngine from '@/engines/SolidEngine';

import { ResourceProperty } from '@/solid';

import { SolidMock } from '@/solid/__mocks__';

import Str from '@/utils/Str';
import Url from '@/utils/Url';

let engine: SolidEngine;

let Solid: SolidMock = require('@/solid').default;

describe('SolidEngine', () => {

    beforeAll(() => {
        Soukai.loadModel('Group', Group);
        Soukai.loadModel('Person', Person);

        Solid.reset();

        engine = new SolidEngine();
    });

    it ('fails when using non-solid models', async () => {
        class MyModel extends Model {}

        Soukai.loadModel('MyModel', MyModel);

        const operations = [
            engine.create(MyModel as any, {}),
            engine.readMany(MyModel as any),
            engine.readOne(MyModel as any, Faker.random.uuid()),
        ];

        for (const operation of operations) {
            await expect(operation).rejects.toBeInstanceOf(SoukaiError);

            const error = await operation.catch(error => error);
            expect(error.message).toEqual('SolidEngine only supports querying SolidModel models');
        }
    });

    it('creates one resource', async () => {
        const resourceUrl = Url.resolve(Faker.internet.url(), Faker.random.uuid());
        const name = Faker.name.firstName();

        const newModelId = await engine.create(Person, {
            url: resourceUrl,
            name,
        });

        expect(newModelId).toEqual(resourceUrl);

        expect(Solid.createResource).toHaveBeenCalledWith(
            resourceUrl,

            // TODO test body using argument matcher
            expect.anything(),
        );
    });

    it('creates one container', async () => {
        const name = Faker.name.firstName();
        const resourceUrl = Url.resolve(Faker.internet.url(), Str.slug(name));

        const newModelId = await engine.create(Group, {
            url: resourceUrl,
            name,
        });

        expect(newModelId).toEqual(resourceUrl);

        expect(Solid.createContainer).toHaveBeenCalledWith(
            resourceUrl,

            // TODO test body using argument matcher
            expect.anything(),
        );
    });

    it('fails when creating resources with undefined fields', async () => {
        const operation = engine.create(Person, {
            lastname: Faker.name.firstName(),
        });

        await expect(operation).rejects.toBeInstanceOf(SoukaiError);

        const error = await operation.catch(error => error);
        expect(error.message).toEqual('Trying to create model with an undefined field "lastname"');
    });

    it('gets one resource', async () => {
        const resourceUrl = Url.resolve(Faker.internet.url(), Faker.random.uuid());
        const name = Faker.name.firstName();

        await Solid.createResource(resourceUrl, [
            ResourceProperty.literal('http://cmlns.com/foaf/0.1/name', name),
        ]);

        const document = await engine.readOne(Person, resourceUrl);

        expect(document).toEqual({ url: resourceUrl, name });

        expect(Solid.getResource).toHaveBeenCalledWith(resourceUrl);
    });

    it("fails reading when resource doesn't exist", async () => {
        await expect(engine.readOne(Person, Faker.internet.url()))
            .rejects
            .toBeInstanceOf(DocumentNotFound);
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
        expect(documents[0]).toEqual({ url: firstUrl, name: firstName });
        expect(documents[1]).toEqual({ url: secondUrl, name: secondName });

        expect(Solid.getResources).toHaveBeenCalledWith(
            containerUrl,
            [
                'http://cmlns.com/foaf/0.1/Person',
                'http://www.w3.org/ns/ldp#Resource',
            ],
        );
    });

    xit('gets many resources using filters', async () => {
        const containerUrl = Faker.internet.url();
        const name = Faker.name.firstName();
        const url = Url.resolve(Faker.internet.url(), Faker.random.uuid());

        // TODO add resources to Solid Mock

        Person.from(containerUrl);

        const documents = await engine.readMany(Person, { name });

        expect(documents).toHaveLength(1);
        expect(documents[0].url).toBe(url);
        expect(documents[0].name).toBe(name);

        expect(Solid.getResources).toHaveBeenCalledWith(
            containerUrl,
            [
                'http://cmlns.com/foaf/0.1/Person',
                'http://www.w3.org/ns/ldp#Resource',
            ],
            { 'http://cmlns.com/foaf/0.1/name': name },
        );
    });

    xit('gets many resources using $in filter', async () => {
        const firstName = Faker.name.firstName();
        const firstUrl = Url.resolve(Faker.internet.url(), Faker.random.uuid());
        const secondName = Faker.name.firstName();
        const secondUrl = Url.resolve(Faker.internet.url(), Faker.random.uuid());

        // TODO add resources to Solid Mock

        const documents = await engine.readMany(Person, {
            $in: [firstUrl, secondUrl],
        });

        expect(documents).toHaveLength(2);
        expect(documents[0].url).toBe(firstUrl);
        expect(documents[0].name).toBe(firstName);
        expect(documents[1].url).toBe(secondUrl);
        expect(documents[1].name).toBe(secondName);

        expect(Solid.getResource).toHaveBeenCalledWith(
            firstUrl,
            [
                'http://cmlns.com/foaf/0.1/Person',
                'http://www.w3.org/ns/ldp#Resource',
            ],
        );

        expect(Solid.getResource).toHaveBeenCalledWith(
            secondUrl,
            [
                'http://cmlns.com/foaf/0.1/Person',
                'http://www.w3.org/ns/ldp#Resource',
            ],
        );
    });

    it('updates dirty attributes', async () => {
        const id = Url.resolve(Faker.internet.url(), Faker.random.uuid());
        const name = Faker.random.word();

        await Solid.createResource(id);

        await engine.update(Person, id, { name }, []);

        expect(Solid.updateResource).toHaveBeenCalledWith(
            id,
            [
                ResourceProperty.literal('http://cmlns.com/foaf/0.1/name', name),
            ],
            [],
        );
    });

    it('deletes attributes', async () => {
        const id = Url.resolve(Faker.internet.url(), Faker.random.uuid());

        await Solid.createResource(id);

        await engine.update(Person, id, {}, ['name']);

        expect(Solid.updateResource).toHaveBeenCalledWith(
            id,
            [],
            ['http://cmlns.com/foaf/0.1/name'],
        );
    });

    it("fails updating when resource doesn't exist", async () => {
        await expect(engine.readOne(Person, Faker.internet.url()))
            .rejects
            .toBeInstanceOf(DocumentNotFound);
    });

});
