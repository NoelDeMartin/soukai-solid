import Faker from 'faker';
import { FieldType, bootModels, setEngine } from 'soukai';
import { stringToSlug, urlResolve, urlResolveDirectory } from '@noeldemartin/utils';
import type { EngineDocument } from 'soukai';

import IRI from '@/solid/utils/IRI';

import { stubGroupJsonLD, stubPersonJsonLD, stubSolidDocumentJsonLD } from '@/testing/lib/stubs/helpers';
import Group from '@/testing/lib/stubs/Group';
import Person from '@/testing/lib/stubs/Person';
import StubEngine from '@/testing/lib/stubs/StubEngine';

import SolidContainerModel from './SolidContainerModel';
import SolidDocument from './SolidDocument';

let engine: StubEngine;

describe('SolidContainerModel', () => {

    beforeAll(() => bootModels({ Group, Person }));

    beforeEach(() => {
        engine = new StubEngine();
        setEngine(engine);
    });

    it('adds ldp:Container rdfsClass', () => {
        class StubModel extends SolidContainerModel {}

        bootModels({ StubModel });

        expect(StubModel.rdfsClasses).toEqual([IRI('ldp:Container')]);
    });

    it('adds resourceUrls field', () => {
        // Arrange
        class StubModel extends SolidContainerModel {

            public static timestamps = false;

        }

        // Act
        bootModels({ StubModel });

        // Assert
        expect(StubModel.fields).toEqual({
            url: {
                type: FieldType.Key,
                required: false,
            },
            name: {
                type: FieldType.String,
                required: false,
                rdfProperty: IRI('rdfs:label'),
            },
            resourceUrls: {
                type: FieldType.Array,
                required: false,
                rdfProperty: IRI('ldp:contains'),
                items: {
                    type: FieldType.Key,
                },
            },
        });
    });

    it('adds documents relation', async () => {
        // Arrange
        const containerUrl = urlResolveDirectory(Faker.internet.url());
        const firstDocumentUrl = urlResolve(containerUrl, Faker.random.uuid());
        const secondDocumentUrl = urlResolve(containerUrl, Faker.random.uuid());

        engine.setOne({
            '@graph': [
                stubGroupJsonLD(
                    containerUrl,
                    Faker.lorem.word(),
                    [firstDocumentUrl, secondDocumentUrl],
                )['@graph'][0],
                stubSolidDocumentJsonLD(firstDocumentUrl, '1997-07-21T23:42:00.000Z')['@graph'][0],
                stubSolidDocumentJsonLD(secondDocumentUrl, '2010-02-15T23:42:00.000Z')['@graph'][0],
            ],
        } as EngineDocument);

        // Act
        const group = await Group.find(containerUrl) as Group;

        // Assert
        expect(group.documents).toHaveLength(2);

        expect(group.documents[0].url).toEqual(firstDocumentUrl);
        expect(group.documents[0].updatedAt).toEqual(new Date('1997-07-21T23:42:00.000Z'));

        expect(group.documents[1].url).toEqual(secondDocumentUrl);
        expect(group.documents[1].updatedAt).toEqual(new Date('2010-02-15T23:42:00.000Z'));
    });

    it('implements contains relationship', async () => {
        // Arrange
        const containerUrl = urlResolveDirectory(Faker.internet.url());
        const musashiUrl = urlResolve(containerUrl, 'musashi');
        const kojiroUrl = urlResolve(containerUrl, 'kojiro');

        const group = new Group({
            url: containerUrl,
            resourceUrls: [
                musashiUrl,
                kojiroUrl,
            ],
        });

        group.setRelationModels('documents', [
            new SolidDocument({ url: musashiUrl }),
            new SolidDocument({ url: kojiroUrl }),
        ]);

        jest.spyOn(engine, 'readMany');

        engine.setMany(containerUrl, {
            [musashiUrl]: stubPersonJsonLD(musashiUrl, 'Musashi'),
            [kojiroUrl]: stubPersonJsonLD(kojiroUrl, 'Kojiro'),
        });

        expect(group.members).toBeUndefined();

        // Act
        await group.loadRelation('members');

        // Assert
        const groupMembers = group.members as Person[];
        expect(groupMembers).toHaveLength(2);
        expect(groupMembers[0]).toBeInstanceOf(Person);
        expect(groupMembers[0].url).toBe(musashiUrl);
        expect(groupMembers[0].name).toBe('Musashi');
        expect(groupMembers[1]).toBeInstanceOf(Person);
        expect(groupMembers[1].url).toBe(kojiroUrl);
        expect(groupMembers[1].name).toBe('Kojiro');

        expect(engine.readMany).toHaveBeenCalledTimes(1);
        expect(engine.readMany).toHaveBeenCalledWith(
            containerUrl,
            {
                '$in': [
                    musashiUrl,
                    kojiroUrl,
                ],
                '@graph': {
                    $contains: {
                        '@type': {
                            $or: [
                                { $contains: ['Person'] },
                                { $contains: [IRI('foaf:Person')] },
                                { $eq: 'Person' },
                                { $eq: IRI('foaf:Person') },
                            ],
                        },
                    },
                },
            },
        );
    });

    it('uses name for minting url for new containers', async () => {
        // Arrange
        class StubModel extends SolidContainerModel {

            public static rdfContexts = {
                foaf: 'http://xmlns.com/foaf/0.1/',
            };

        }

        const containerUrl = urlResolveDirectory(Faker.internet.url());
        const name = Faker.random.word();

        jest.spyOn(engine, 'create');

        bootModels({ StubModel });

        // Act
        const model = await StubModel.at(containerUrl).create({ name });

        // Assert
        expect(typeof model.url).toEqual('string');
        expect(model.url).toEqual(urlResolveDirectory(containerUrl, stringToSlug(name)));

        expect(engine.create).toHaveBeenCalledWith(
            containerUrl,
            expect.anything(),
            model.url,
        );
    });

    it('mints unique urls when urls are already in use', async () => {
        class StubModel extends SolidContainerModel {

            public static rdfContexts = {
                foaf: 'http://xmlns.com/foaf/0.1/',
            };

        }

        const name = Faker.random.word();
        const slug = stringToSlug(name);
        const containerUrl = urlResolveDirectory(Faker.internet.url());
        const escapedContainerUrl = containerUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const resourceUrl = urlResolveDirectory(containerUrl, slug);

        engine.setOne({ url: resourceUrl });

        jest.spyOn(engine, 'create');

        bootModels({ StubModel });

        // Act
        const model = await StubModel.at(containerUrl).create({ name });

        // Assert
        expect(typeof model.url).toEqual('string');
        expect(model.url).not.toEqual(resourceUrl);
        expect(model.url).toMatch(new RegExp(`^${escapedContainerUrl}${slug}-[\\d\\w-]+/$`));

        expect(engine.create).toHaveBeenCalledWith(
            containerUrl,
            expect.anything(),
            resourceUrl,
        );
        expect(engine.create).toHaveBeenCalledWith(
            containerUrl,
            expect.anything(),
            model.url,
        );
    });

    it('empty documents relation gets initialized', async () => {
        const group = await Group.create({ name: Faker.random.word() }) as Group;

        expect(group.isRelationLoaded('documents')).toBe(true);
        expect(group.documents).toEqual([]);
    });

});
