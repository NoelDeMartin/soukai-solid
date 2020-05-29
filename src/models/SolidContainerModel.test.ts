import 'fake-indexeddb/auto';

import Faker from 'faker';
import Soukai, { FieldType } from 'soukai';

import { IRI } from '@/solid/utils/RDF';

import Str from '@/utils/Str';
import Url from '@/utils/Url';

import { stubPersonJsonLD, stubGroupJsonLD, stubSolidDocumentJsonLD } from '@tests/stubs/helpers';
import Group from '@tests/stubs/Group';
import Person from '@tests/stubs/Person';
import StubEngine from '@tests/stubs/StubEngine';

import SolidContainerModel from './SolidContainerModel';
import SolidDocument from './SolidDocument';

let engine: StubEngine;

describe('SolidContainerModel', () => {

    beforeAll(() => {Soukai.loadModels({ Group, Person })});

    beforeEach(() => {
        engine = new StubEngine();
        Soukai.useEngine(engine);
    });

    it('adds ldp:Container rdfsClass', () => {
        class StubModel extends SolidContainerModel {}

        Soukai.loadModels({ StubModel });

        expect(StubModel.rdfsClasses).toEqual(new Set([IRI('ldp:Container')]));
    });

    it('adds resourceUrls field', () => {
        // Arrange
        class StubModel extends SolidContainerModel {

            public static timestamps = false;

        }

        // Act
        Soukai.loadModels({ StubModel });

        // Assert
        expect(StubModel.fields).toEqual({
            url: {
                type: FieldType.Key,
                required: false,
                rdfProperty: null,
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
        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const firstDocumentUrl = Url.resolve(containerUrl, Faker.random.uuid());
        const secondDocumentUrl = Url.resolve(containerUrl, Faker.random.uuid());

        engine.setOne({
            '@graph': [
                stubGroupJsonLD(containerUrl, Faker.lorem.word())['@graph'][0],
                stubSolidDocumentJsonLD(firstDocumentUrl, '1997-07-21T23:42:00.000Z')['@graph'][0],
                stubSolidDocumentJsonLD(secondDocumentUrl, '2010-02-15T23:42:00.000Z')['@graph'][0],
            ],
        });

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
        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const musashiUrl = Url.resolve(containerUrl, 'musashi');
        const kojiroUrl = Url.resolve(containerUrl, 'kojiro');

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
        expect(group.members!).toHaveLength(2);
        expect(group.members![0]).toBeInstanceOf(Person);
        expect(group.members![0].url).toBe(musashiUrl);
        expect(group.members![0].name).toBe('Musashi');
        expect(group.members![1]).toBeInstanceOf(Person);
        expect(group.members![1].url).toBe(kojiroUrl);
        expect(group.members![1].name).toBe('Kojiro');

        expect(engine.readMany).toHaveBeenCalledTimes(1);
        expect(engine.readMany).toHaveBeenCalledWith(
            containerUrl,
            {
                $in: [
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
                'foaf': 'http://xmlns.com/foaf/0.1/',
            };

            public static fields = {
                name: FieldType.String,
            };
        }

        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const name = Faker.random.word();

        jest.spyOn(engine, 'create');

        Soukai.loadModels({ StubModel });

        // Act
        const model = await StubModel.at(containerUrl).create({ name });

        // Assert
        expect(typeof model.url).toEqual('string');
        expect(model.url).toEqual(Url.resolveDirectory(containerUrl, Str.slug(name)));

        expect(engine.create).toHaveBeenCalledWith(
            containerUrl,
            expect.anything(),
            model.url,
        );
    });

});
