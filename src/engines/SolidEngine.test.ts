import { DocumentNotFound, EngineAttributes, DocumentAlreadyExists } from 'soukai';

import Faker from 'faker';

import SolidEngine from '@/engines/SolidEngine';

import { ResourceProperty } from '@/solid';

import SolidClientMock from '@/solid/__mocks__';

import { stubPersonJsonLD, stubGroupJsonLD } from '@tests/stubs/helpers';

import Str from '@/utils/Str';
import Url from '@/utils/Url';
import Arr from '@/utils/Arr';

let engine: SolidEngine;

describe('SolidEngine', () => {

    beforeAll(() => {
        SolidClientMock.reset();

        // TODO use dependency injection instead of doing this
        engine = new SolidEngine(null as any);
        (engine as any).client = SolidClientMock;
    });

    it('creates one resource', async () => {
        const parentUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(Faker.random.word()));
        const resourceUrl = Url.resolve(parentUrl, Faker.random.uuid());
        const name = Faker.name.firstName();
        const date = Faker.date.recent();

        const jsonLD = stubPersonJsonLD(resourceUrl, name);
        jsonLD['date'] = date;

        const id = await engine.create(parentUrl, jsonLD, resourceUrl);

        expect(id).toEqual(resourceUrl);

        expect(SolidClientMock.createResource).toHaveBeenCalledWith(
            parentUrl,
            resourceUrl,

            // TODO test body using argument matcher
            expect.anything(),
        );

        const properties = (SolidClientMock.createResource as any).mock.calls[0][2];

        expect(properties).toHaveLength(4);
        expect(properties).toContainEqual(ResourceProperty.type('http://www.w3.org/ns/ldp#Resource'));
        expect(properties).toContainEqual(ResourceProperty.type('http://xmlns.com/foaf/0.1/Person'));
        expect(properties).toContainEqual(ResourceProperty.literal('http://xmlns.com/foaf/0.1/name', name));
        expect(properties).toContainEqual(ResourceProperty.literal('date', date));
    });

    it('creates one container', async () => {
        const name = Faker.name.firstName();
        const parentUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(Faker.random.word()));
        const resourceUrl = Url.resolve(parentUrl, Str.slug(name));

        const id = await engine.create(
            Url.parentDirectory(resourceUrl),
            stubGroupJsonLD(resourceUrl, name),
            resourceUrl,
        );

        expect(id).toEqual(resourceUrl);

        expect(SolidClientMock.createResource).toHaveBeenCalledWith(
            parentUrl,
            resourceUrl,

            // TODO test body using argument matcher
            expect.anything(),
        );
    });

    it('fails creating resources if the provided url is already in use', async () => {
        const parentUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(Faker.random.word()));
        const resourceUrl = Url.resolve(parentUrl, Faker.random.uuid());

        await SolidClientMock.createResource(parentUrl, resourceUrl, [
            ResourceProperty.type('http://www.w3.org/ns/ldp#Resource'),
        ]);

        await expect(engine.create(parentUrl, {}, resourceUrl))
            .rejects
            .toBeInstanceOf(DocumentAlreadyExists);
    });

    it('gets one resource', async () => {
        const parentUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(Faker.random.word()));
        const resourceUrl = Url.resolve(parentUrl, Faker.random.uuid());
        const name = Faker.name.firstName();

        await SolidClientMock.createResource(parentUrl, resourceUrl, [
            ResourceProperty.type('http://www.w3.org/ns/ldp#Resource'),
            ResourceProperty.type('http://www.w3.org/ns/ldp#Container'),
            ResourceProperty.type('http://xmlns.com/foaf/0.1/Group'),
            ResourceProperty.literal('http://xmlns.com/foaf/0.1/name', name),
        ]);

        const document = withoutEmbeddedResources(
            await engine.readOne(Url.parentDirectory(resourceUrl), resourceUrl),
        );

        expect(document).toEqual(stubGroupJsonLD(resourceUrl, name));

        expect(SolidClientMock.getResource).toHaveBeenCalledWith(resourceUrl);
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
        const thirdUrl = `${secondUrl}#${Faker.random.uuid()}`;
        const firstName = Faker.name.firstName();
        const secondName = Faker.name.firstName();
        const thirdName = Faker.name.firstName();

        await SolidClientMock.createResource(containerUrl, firstUrl, [
            ResourceProperty.type('http://www.w3.org/ns/ldp#Resource'),
            ResourceProperty.type('http://xmlns.com/foaf/0.1/Person'),
            ResourceProperty.literal('http://xmlns.com/foaf/0.1/name', firstName),
        ]);

        await SolidClientMock.createResource(containerUrl, secondUrl, [
            ResourceProperty.type('http://www.w3.org/ns/ldp#Resource'),
            ResourceProperty.type('http://xmlns.com/foaf/0.1/Person'),
            ResourceProperty.literal('http://xmlns.com/foaf/0.1/name', secondName),
        ]);

        await SolidClientMock.createEmbeddedResource(secondUrl, thirdUrl, [
            ResourceProperty.type('http://xmlns.com/foaf/0.1/Person'),
            ResourceProperty.literal('http://xmlns.com/foaf/0.1/name', thirdName),
        ]);

        const documents = await engine.readMany(containerUrl);

        expect(Object.keys(documents)).toHaveLength(3);
        expect(withoutEmbeddedResources(documents[firstUrl])).toEqual(stubPersonJsonLD(firstUrl, firstName));
        expect(withoutEmbeddedResources(documents[secondUrl])).toEqual(stubPersonJsonLD(secondUrl, secondName));
        expect(withoutEmbeddedResources(documents[thirdUrl])).toEqual(stubPersonJsonLD(thirdUrl, thirdName, false));

        expect(SolidClientMock.getResources).toHaveBeenCalledWith(containerUrl, []);
    });

    it('gets many resources filtering by type', async () => {
        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const firstUrl = Url.resolve(containerUrl, 'first');
        const secondUrl = Url.resolve(containerUrl, 'second');
        const thirdUrl = `${secondUrl}#${Faker.random.uuid()}`;
        const firstName = Faker.name.firstName();
        const secondName = Faker.name.firstName();
        const thirdName = Faker.name.firstName();

        await SolidClientMock.createResource(containerUrl, firstUrl, [
            ResourceProperty.type('http://www.w3.org/ns/ldp#Resource'),
            ResourceProperty.type('http://xmlns.com/foaf/0.1/Person'),
            ResourceProperty.literal('http://xmlns.com/foaf/0.1/name', firstName),
        ]);

        await SolidClientMock.createResource(containerUrl, secondUrl, [
            ResourceProperty.type('http://www.w3.org/ns/ldp#Resource'),
            ResourceProperty.type('http://xmlns.com/foaf/0.1/Person'),
            ResourceProperty.literal('http://xmlns.com/foaf/0.1/name', secondName),
        ]);

        await SolidClientMock.createEmbeddedResource(secondUrl, thirdUrl, [
            ResourceProperty.type('http://xmlns.com/foaf/0.1/Person'),
            ResourceProperty.literal('http://xmlns.com/foaf/0.1/name', thirdName),
        ]);

        const documents = await engine.readMany(containerUrl, {
            '@type': {
                $or: [
                    {
                        $contains: [
                            { '@id': 'http://xmlns.com/foaf/0.1/Person' },
                        ],
                    },
                    {
                        $eq: { '@id': 'http://xmlns.com/foaf/0.1/Person' },
                    },
                ],
            },
        });

        expect(Object.keys(documents)).toHaveLength(3);
        expect(withoutEmbeddedResources(documents[firstUrl])).toEqual(stubPersonJsonLD(firstUrl, firstName));
        expect(withoutEmbeddedResources(documents[secondUrl])).toEqual(stubPersonJsonLD(secondUrl, secondName));
        expect(withoutEmbeddedResources(documents[thirdUrl])).toEqual(stubPersonJsonLD(thirdUrl, thirdName, false));

        // TODO this should filter by Person type for better network performance
        expect(SolidClientMock.getResources).toHaveBeenCalledWith(containerUrl, []);
    });

    it('gets many resources filtering by attributes', async () => {
        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const name = Faker.name.firstName();
        const url = Url.resolve(containerUrl, Faker.random.uuid());

        await SolidClientMock.createResource(containerUrl, url, [
            ResourceProperty.type('http://www.w3.org/ns/ldp#Resource'),
            ResourceProperty.type('http://xmlns.com/foaf/0.1/Person'),
            ResourceProperty.literal('http://xmlns.com/foaf/0.1/name', name),
        ]);

        await SolidClientMock.createResource(containerUrl, Url.resolve(containerUrl, Faker.random.uuid()), [
            ResourceProperty.type('http://www.w3.org/ns/ldp#Resource'),
            ResourceProperty.type('http://xmlns.com/foaf/0.1/Person'),
            ResourceProperty.literal('http://xmlns.com/foaf/0.1/name', Faker.name.firstName()),
        ]);

        const documents = await engine.readMany(
            containerUrl,
            { 'http://xmlns.com/foaf/0.1/name': name },
        );

        expect(Object.keys(documents)).toHaveLength(1);
        expect(withoutEmbeddedResources(documents[url])).toEqual(stubPersonJsonLD(url, name));

        expect(SolidClientMock.getResources).toHaveBeenCalledWith(
            containerUrl,
            [],
        );
    });

    it('gets many resources using $in filter', async () => {
        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const brokenUrl = Url.resolve(containerUrl, Faker.random.uuid());
        const firstName = Faker.name.firstName();
        const firstUrl = Url.resolve(containerUrl, Faker.random.uuid());
        const secondName = Faker.name.firstName();
        const secondUrl = Url.resolve(containerUrl, Faker.random.uuid());

        await SolidClientMock.createResource(containerUrl, firstUrl, [
            ResourceProperty.type('http://www.w3.org/ns/ldp#Resource'),
            ResourceProperty.type('http://xmlns.com/foaf/0.1/Person'),
            ResourceProperty.literal('http://xmlns.com/foaf/0.1/name', firstName),
        ]);

        await SolidClientMock.createResource(containerUrl, secondUrl, [
            ResourceProperty.type('http://www.w3.org/ns/ldp#Resource'),
            ResourceProperty.type('http://xmlns.com/foaf/0.1/Person'),
            ResourceProperty.literal('http://xmlns.com/foaf/0.1/name', secondName),
        ]);

        const documents = await engine.readMany(containerUrl, {
            $in: [brokenUrl, firstUrl, secondUrl],
        });

        expect(Object.keys(documents)).toHaveLength(2);
        expect(withoutEmbeddedResources(documents[firstUrl])).toEqual(stubPersonJsonLD(firstUrl, firstName));
        expect(withoutEmbeddedResources(documents[secondUrl])).toEqual(stubPersonJsonLD(secondUrl, secondName));

        expect(SolidClientMock.getResource).toHaveBeenCalledWith(firstUrl);
        expect(SolidClientMock.getResource).toHaveBeenCalledWith(secondUrl);
    });

    it('gets many resources using globbing for $in filter', async () => {
        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const resourcesCount = 10;
        const urls: string[] = [];
        const names: string[] = [];

        await Promise.all(Arr.range(resourcesCount).map(async i => {
            const url = Url.resolve(containerUrl, `resource-${i}`);
            const name = Faker.name.firstName();

            urls.push(url);
            names.push(name);

            await SolidClientMock.createResource(containerUrl, url, [
                ResourceProperty.type('http://www.w3.org/ns/ldp#Resource'),
                ResourceProperty.type('http://xmlns.com/foaf/0.1/Person'),
                ResourceProperty.literal('http://xmlns.com/foaf/0.1/name', name),
            ]);
        }));

        const documents = await engine.readMany(containerUrl, { $in: urls });

        expect(Object.keys(documents)).toHaveLength(resourcesCount);

        Arr.zip(urls, names).map(([url, name]) => {
            expect(withoutEmbeddedResources(documents[url])).toEqual(stubPersonJsonLD(url, name));
        });

        expect(SolidClientMock.getResources).toHaveBeenCalledWith(containerUrl, []);
    });

    it.only('gets many resources using cache', async () => {
        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const resourcesCount = 5;
        const cachedResourcesCount = 5;
        const urls: string[] = [];
        const names: string[] = [];

        engine.config.globbingBatchSize = null;
        engine.config.useCache = true;

        await Promise.all(Arr.range(resourcesCount).map(async i => {
            const url = Url.resolve(containerUrl, `resource-${i}`);
            const name = Faker.name.firstName();

            urls.push(url);
            names.push(name);

            await SolidClientMock.createResource(containerUrl, url, [
                ResourceProperty.type('http://www.w3.org/ns/ldp#Resource'),
                ResourceProperty.type('http://xmlns.com/foaf/0.1/Person'),
                ResourceProperty.literal('http://xmlns.com/foaf/0.1/name', name),
            ]);
        }));

        Arr.range(cachedResourcesCount).forEach(i => {
            const url = Url.resolve(containerUrl, `cached-resource-${i}`);
            const name = Faker.name.firstName();

            urls.push(url);
            names.push(name);
            engine.cache.add({ ...stubPersonJsonLD(url, name), __embedded: {} });
        });

        const documents = await engine.readMany(containerUrl, { $in: urls });

        expect(Object.keys(documents)).toHaveLength(resourcesCount + cachedResourcesCount);

        Arr.zip(urls, names).map(([url, name]) => {
            expect(withoutEmbeddedResources(documents[url])).toEqual(stubPersonJsonLD(url, name));
        });

        urls.slice(0, resourcesCount).map(url => expect(SolidClientMock.getResource).toHaveBeenCalledWith(url));
        urls.slice(resourcesCount).map(url => expect(SolidClientMock.getResource).not.toHaveBeenCalledWith(url));
    });

    it('updates resources updated attributes', async () => {
        const parentUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(Faker.random.word()));
        const resourceUrl = Url.resolve(parentUrl, Faker.random.uuid());
        const name = Faker.random.word();

        await SolidClientMock.createResource(parentUrl, resourceUrl);

        await engine.update(
            parentUrl,
            resourceUrl,
            { 'http://xmlns.com/foaf/0.1/name': name },
            [],
        );

        expect(SolidClientMock.updateResource).toHaveBeenCalledWith(
            resourceUrl,
            [
                ResourceProperty.literal('http://xmlns.com/foaf/0.1/name', name),
            ],
            [],
        );
    });

    it('updates resources removed attributes', async () => {
        const parentUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(Faker.random.word()));
        const resourceUrl = Url.resolve(parentUrl, Faker.random.uuid());

        await SolidClientMock.createResource(parentUrl, resourceUrl);

        await engine.update(
            parentUrl,
            resourceUrl,
            {},
            ['http://xmlns.com/foaf/0.1/name'],
        );

        expect(SolidClientMock.updateResource).toHaveBeenCalledWith(
            resourceUrl,
            [],
            ['http://xmlns.com/foaf/0.1/name'],
        );
    });

    it("fails updating when resource doesn't exist", async () => {
        const resourceUrl = Url.resolve(Faker.internet.url(), Faker.random.uuid());

        await expect(engine.readOne(Url.parentDirectory(resourceUrl), resourceUrl))
            .rejects
            .toBeInstanceOf(DocumentNotFound);
    });

});

function withoutEmbeddedResources(document: EngineAttributes): EngineAttributes {
   return SolidEngine.decantEmbeddedDocuments(document)[0];
}
