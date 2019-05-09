jest.mock('@/solid');

import { DocumentNotFound } from 'soukai';

import Faker from 'faker';

import SolidEngine from '@/engines/SolidEngine';

import { ResourceProperty } from '@/solid';

import { SolidMock } from '@/solid/__mocks__';

import { stubPersonJsonLD, stubGroupJsonLD } from '@tests/stubs/helpers';

import Str from '@/utils/Str';
import Url from '@/utils/Url';

let engine: SolidEngine;

let Solid: SolidMock = require('@/solid').default;

describe('SolidEngine', () => {

    beforeAll(() => {
        Solid.reset();

        engine = new SolidEngine();
    });

    it('creates one resource', async () => {
        const resourceUrl = Url.resolve(Faker.internet.url(), Faker.random.uuid());
        const name = Faker.name.firstName();

        const id = await engine.create(
            Url.parentDirectory(resourceUrl),
            stubPersonJsonLD(resourceUrl, name),
            resourceUrl,
        );

        expect(id).toEqual(resourceUrl);

        expect(Solid.createResource).toHaveBeenCalledWith(
            resourceUrl,

            // TODO test body using argument matcher
            expect.anything(),
        );
    });

    it('creates one container', async () => {
        const name = Faker.name.firstName();
        const resourceUrl = Url.resolve(Faker.internet.url(), Str.slug(name));

        const id = await engine.create(
            Url.parentDirectory(resourceUrl),
            stubGroupJsonLD(resourceUrl, name),
            resourceUrl,
        );

        expect(id).toEqual(resourceUrl);

        expect(Solid.createContainer).toHaveBeenCalledWith(
            resourceUrl,

            // TODO test body using argument matcher
            expect.anything(),
        );
    });

    it('gets one resource', async () => {
        const resourceUrl = Url.resolve(Faker.internet.url(), Faker.random.uuid());
        const name = Faker.name.firstName();

        await Solid.createResource(resourceUrl, [
            ResourceProperty.type('http://www.w3.org/ns/ldp#Resource'),
            ResourceProperty.type('http://www.w3.org/ns/ldp#Container'),
            ResourceProperty.type('http://cmlns.com/foaf/0.1/Group'),
            ResourceProperty.literal('http://cmlns.com/foaf/0.1/name', name),
        ]);

        const document = await engine.readOne(Url.parentDirectory(resourceUrl), resourceUrl);

        expect(document).toEqual(stubGroupJsonLD(resourceUrl, name));

        expect(Solid.getResource).toHaveBeenCalledWith(resourceUrl);
    });

    it("fails reading when resource doesn't exist", async () => {
        const resourceUrl = Url.resolve(Faker.internet.url(), Faker.random.uuid());

        await expect(engine.readOne(Url.parentDirectory(resourceUrl), resourceUrl))
            .rejects
            .toBeInstanceOf(DocumentNotFound);
    });

    it('gets many resources', async () => {
        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const firstUrl = Url.resolve(containerUrl, 'first');
        const secondUrl = Url.resolve(containerUrl, 'second');
        const firstName = Faker.name.firstName();
        const secondName = Faker.name.firstName();

        await Solid.createResource(firstUrl, [
            ResourceProperty.type('http://www.w3.org/ns/ldp#Resource'),
            ResourceProperty.type('http://cmlns.com/foaf/0.1/Person'),
            ResourceProperty.literal('http://cmlns.com/foaf/0.1/name', firstName),
        ]);

        await Solid.createResource(secondUrl, [
            ResourceProperty.type('http://www.w3.org/ns/ldp#Resource'),
            ResourceProperty.type('http://cmlns.com/foaf/0.1/Person'),
            ResourceProperty.literal('http://cmlns.com/foaf/0.1/name', secondName),
        ]);

        const documents = await engine.readMany(containerUrl);

        expect(Object.keys(documents)).toHaveLength(2);
        expect(documents[firstUrl]).toEqual(stubPersonJsonLD(firstUrl, firstName));
        expect(documents[secondUrl]).toEqual(stubPersonJsonLD(secondUrl, secondName));

        expect(Solid.getResources).toHaveBeenCalledWith(containerUrl, []);
    });

    it('gets many resources filtering by type', async () => {
        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const firstUrl = Url.resolve(containerUrl, 'first');
        const secondUrl = Url.resolve(containerUrl, 'second');
        const firstName = Faker.name.firstName();
        const secondName = Faker.name.firstName();

        await Solid.createResource(firstUrl, [
            ResourceProperty.type('http://www.w3.org/ns/ldp#Resource'),
            ResourceProperty.type('http://cmlns.com/foaf/0.1/Person'),
            ResourceProperty.literal('http://cmlns.com/foaf/0.1/name', firstName),
        ]);

        await Solid.createResource(secondUrl, [
            ResourceProperty.type('http://www.w3.org/ns/ldp#Resource'),
            ResourceProperty.type('http://cmlns.com/foaf/0.1/Person'),
            ResourceProperty.literal('http://cmlns.com/foaf/0.1/name', secondName),
        ]);

        const documents = await engine.readMany(containerUrl, {
            '@type': {
                $contains: [
                    { '@id': 'http://www.w3.org/ns/ldp#Resource' },
                    { '@id': 'http://cmlns.com/foaf/0.1/Person' },
                ],
            },
        });

        expect(Object.keys(documents)).toHaveLength(2);
        expect(documents[firstUrl]).toEqual(stubPersonJsonLD(firstUrl, firstName));
        expect(documents[secondUrl]).toEqual(stubPersonJsonLD(secondUrl, secondName));

        expect(Solid.getResources).toHaveBeenCalledWith(containerUrl, [
            'http://www.w3.org/ns/ldp#Resource',
            'http://cmlns.com/foaf/0.1/Person',
        ]);
    });

    xit('gets many resources filtering by attributes', async () => {
        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const name = Faker.name.firstName();
        const url = Url.resolve(Faker.internet.url(), Faker.random.uuid());

        // TODO add resources to Solid Mock

        const documents = await engine.readMany(
            containerUrl,
            { name },
        );

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
        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const firstName = Faker.name.firstName();
        const firstUrl = Url.resolve(containerUrl, Faker.random.uuid());
        const secondName = Faker.name.firstName();
        const secondUrl = Url.resolve(containerUrl, Faker.random.uuid());

        // TODO add resources to Solid Mock

        const documents = await engine.readMany(containerUrl, {
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

    it('updates resources updated attributes', async () => {
        const resourceUrl = Url.resolve(Faker.internet.url(), Faker.random.uuid());
        const name = Faker.random.word();

        await Solid.createResource(resourceUrl);

        await engine.update(
            Url.parentDirectory(resourceUrl),
            resourceUrl,
            { 'http://cmlns.com/foaf/0.1/name': name },
            [],
        );

        expect(Solid.updateResource).toHaveBeenCalledWith(
            resourceUrl,
            [
                ResourceProperty.literal('http://cmlns.com/foaf/0.1/name', name),
            ],
            [],
        );
    });

    it('updates resources removed attributes', async () => {
        const resourceUrl = Url.resolve(Faker.internet.url(), Faker.random.uuid());

        await Solid.createResource(resourceUrl);

        await engine.update(
            Url.parentDirectory(resourceUrl),
            resourceUrl,
            {},
            ['http://cmlns.com/foaf/0.1/name'],
        );

        expect(Solid.updateResource).toHaveBeenCalledWith(
            resourceUrl,
            [],
            ['http://cmlns.com/foaf/0.1/name'],
        );
    });

    it("fails updating when resource doesn't exist", async () => {
        const resourceUrl = Url.resolve(Faker.internet.url(), Faker.random.uuid());

        await expect(engine.readOne(Url.parentDirectory(resourceUrl), resourceUrl))
            .rejects
            .toBeInstanceOf(DocumentNotFound);
    });

});
