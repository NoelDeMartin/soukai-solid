import Faker from 'faker';

import Soukai, { FieldType } from 'soukai';

import { IRI } from '@/solid/utils/RDF';

import Str from '@/utils/Str';
import Url from '@/utils/Url';

import { stubPersonJsonLD, stubGroupJsonLD, stubWatchActionJsonLD, stubMovieJsonLD } from '@tests/stubs/helpers';
import Group from '@tests/stubs/Group';
import Movie from '@tests/stubs/Movie';
import Person from '@tests/stubs/Person';
import StubEngine from '@tests/stubs/StubEngine';
import WatchAction from '@tests/stubs/WatchAction';

import SolidModel from './SolidModel';

let engine: StubEngine;

describe('SolidModel', () => {

    beforeAll(() => {
        Soukai.loadModels({
            Group,
            Person,
            Movie,
            WatchAction,
        });
    });

    beforeEach(() => {
        engine = new StubEngine();
        Soukai.useEngine(engine);
    });

    it('resolves contexts when booting', () => {
        class StubModel extends SolidModel {

            public static timestamps = false;

            public static rdfContexts = {
                'foaf': 'http://xmlns.com/foaf/0.1/',
            };

            public static rdfsClasses = ['foaf:Person'];

            public static fields = {
                name: {
                    type: FieldType.String,
                    rdfProperty: 'foaf:givenname',
                },
            };

        }

        Soukai.loadModels({ StubModel });

        expect(StubModel.rdfsClasses).toEqual(new Set([
            'http://xmlns.com/foaf/0.1/Person',
        ]));

        expect(StubModel.fields).toEqual({
            url: {
                type: FieldType.Key,
                required: false,
                rdfProperty: null,
            },
            name: {
                type: FieldType.String,
                required: false,
                rdfProperty: 'http://xmlns.com/foaf/0.1/givenname',
            },
        });
    });

    it('defaults to first context if rdfProperty is missing', () => {
        class StubModel extends SolidModel {

            public static timestamps = false;

            public static rdfContexts = {
                'foaf': 'http://xmlns.com/foaf/0.1/',
            };

            public static fields = {
                name: FieldType.String,
            };

        }

        Soukai.loadModels({ StubModel });

        expect(StubModel.fields).toEqual({
            url: {
                type: FieldType.Key,
                required: false,
                rdfProperty: null,
            },
            name: {
                type: FieldType.String,
                required: false,
                rdfProperty: 'http://xmlns.com/foaf/0.1/name',
            },
        });
    });

    it('allows adding undefined fields', async () => {
        class StubModel extends SolidModel {
        }

        const containerUrl = Url.resolveDirectory(Faker.internet.url());

        jest.spyOn(engine, 'create');

        Soukai.loadModels({ StubModel });

        await StubModel.at(containerUrl).create({ nickname: 'Johnny' });

        const document = (engine.create as any).mock.calls[0][1];

        expect(document['@graph'][0]['nickname']).toEqual('Johnny');
    });

    it('sends types on create', async () => {
        class StubModel extends SolidModel {
        }

        jest.spyOn(engine, 'create');

        Soukai.loadModels({ StubModel });

        await StubModel.create({});

        const document = (engine.create as any).mock.calls[0][1];

        expect(document['@graph'][0]['@type']).not.toBeUndefined();
    });

    it('sends JSON-LD with related models in the same document', async () => {
        // Arrange
        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const movieName = Faker.name.title();
        const movieUrl = Url.resolve(containerUrl, Str.slug(movieName));
        const movie = new Movie({ url: movieUrl, name: movieName });
        const action = await movie.relatedActions.create({ startTime: new Date('1997-07-21T23:42:00Z') }, true);

        jest.spyOn(engine, 'create');

        // Act
        await movie.save(containerUrl);

        // Assert
        expect(engine.create).toHaveBeenCalledWith(
            containerUrl,
            expect.anything(),
            movieUrl,
        );

        const document = (engine.create as any).mock.calls[0][1];
        await expect(document).toEqualJsonLD({
            '@graph': [
                ...stubMovieJsonLD(movieUrl, movieName)['@graph'],
                ...stubWatchActionJsonLD(action.url, movieUrl, '1997-07-21T23:42:00.000Z')['@graph'],
            ],
        });

        expect(movie.exists()).toBe(true);
        expect(movie.actions![0].exists()).toBe(true);
        expect(movie.actions![0].object).toEqual(movieUrl);
    });

    it('converts filters to JSON-LD', async () => {
        // Arrange
        const peopleUrl = 'https://example.com/people/';
        const aliceUrl = `${peopleUrl}alice`;

        engine.setMany(peopleUrl, {
            [aliceUrl]: stubPersonJsonLD(aliceUrl, 'Alice'),
        });

        jest.spyOn(engine, 'readMany');

        // Act
        const people = await Person.from(peopleUrl).all({ name: 'Alice' });

        // Assert
        expect(people).toHaveLength(1);
        expect(people[0].url).toEqual(aliceUrl);
        expect(people[0].name).toEqual('Alice');

        expect(engine.readMany).toHaveBeenCalledWith(
            peopleUrl,
            {
                '@graph': {
                    $contains: {
                        '@type': {
                            $or: [
                                { $contains: ['Person'] },
                                { $contains: ['http://xmlns.com/foaf/0.1/Person'] },
                                { $eq: 'Person' },
                                { $eq: 'http://xmlns.com/foaf/0.1/Person' },
                            ],
                        },
                        [IRI('foaf:name')]: 'Alice',
                    },
                }
            },
        );
    });

    it('converts updates to JSON-LD', async () => {
        // Arrange.
        class StubModel extends SolidModel {
            static timestamps = false;
        }

        jest.spyOn(engine, 'update');

        Soukai.loadModels({ StubModel });

        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const model = new StubModel(
            {
                url: Url.resolve(containerUrl, Faker.random.uuid()),
                surname: Faker.name.lastName(),
            },
            true,
        );

        // Act.
        model.name = 'John';
        delete model.surname;

        await model.save();

        // Assert.
        expect(engine.update).toHaveBeenCalledWith(
            containerUrl,
            model.url,
            {
                '@graph': {
                    $updateItems: {
                        $where: { '@id': model.url },
                        $update: {
                            [IRI('solid:name')]: 'John',
                            [IRI('solid:surname')]: { $unset: true },
                        },
                    },
                },
            },
        );
    });

    it('reads many from a directory', async () => {
        class StubModel extends SolidModel {
        }

        const containerUrl = Url.resolveDirectory(Faker.internet.url());

        jest.spyOn(engine, 'readMany');

        Soukai.loadModels({ StubModel });

        await StubModel.at(containerUrl).all();

        expect(engine.readMany).toHaveBeenCalledWith(containerUrl, expect.anything());
    });

    it('reads many from a document', async () => {
        class StubModel extends SolidModel {
        }

        const documentUrl = Url.resolve(Faker.internet.url(), Faker.random.word());

        jest.spyOn(engine, 'readMany');

        Soukai.loadModels({ StubModel });

        await StubModel.at(documentUrl).all();

        expect(engine.readMany).toHaveBeenCalledWith(documentUrl, expect.anything());
    });

    it('mints url for new models', async () => {
        class StubModel extends SolidModel {
        }

        const containerUrl = Url.resolveDirectory(Faker.internet.url());

        jest.spyOn(engine, 'create');

        Soukai.loadModels({ StubModel });

        const model = await StubModel.at(containerUrl).create();

        expect(typeof model.url).toEqual('string');
        expect(model.url.startsWith(containerUrl)).toBe(true);

        expect(engine.create).toHaveBeenCalledWith(
            containerUrl,
            expect.anything(),
            model.url,
        );
    });

    it("doesn't mint urls for new models if disabled", async () => {
        class StubModel extends SolidModel {
            static mintsUrls = false;
        }

        const containerUrl = Url.resolveDirectory(Faker.internet.url());

        jest.spyOn(engine, 'create');

        Soukai.loadModels({ StubModel });

        await StubModel.at(containerUrl).create();

        expect(engine.create).toHaveBeenCalledWith(
            containerUrl,
            expect.anything(),
            undefined,
        );
    });

    it('adds url prefixes when urls are already in use', async () => {
        class StubModel extends SolidModel {
        }

        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const resourceUrl = Url.resolve(containerUrl, Faker.random.word());

        engine.setOne({ url: resourceUrl });

        jest.spyOn(engine, 'create');

        Soukai.loadModels({ StubModel });

        const model = await StubModel.at(containerUrl).create({
            url: resourceUrl,
        });

        expect(typeof model.url).toEqual('string');
        expect(model.url).not.toEqual(resourceUrl);
        expect(model.url.startsWith(containerUrl)).toBe(true);

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

    it('uses explicit containerUrl for minting url on save', async () => {
        class StubModel extends SolidModel {
        }

        const containerUrl = Url.resolveDirectory(Faker.internet.url());

        jest.spyOn(engine, 'create');

        Soukai.loadModels({ StubModel });

        const model = new StubModel();

        await model.save(containerUrl);

        expect(typeof model.url).toEqual('string');
        expect(model.url.startsWith(containerUrl)).toBe(true);

        expect(engine.create).toHaveBeenCalledWith(
            containerUrl,
            expect.anything(),
            model.url,
        );
    });

    it('uses hash fragment for minting model urls in the same document', async () => {
        // Arrange
        const movieUrl = Url.resolve(Faker.internet.url(), Faker.random.uuid());
        const movie = new Movie({ url: movieUrl }, true);

        jest.spyOn(engine, 'update');

        // Act
        const action = await movie.relatedActions.create({}, true);

        // Assert
        expect(typeof action.url).toEqual('string');
        expect(action.url.startsWith(movieUrl + '#')).toBe(true);
        expect(action.exists()).toBe(true);

        expect(engine.update).toHaveBeenCalledWith(
            expect.anything(),
            movieUrl,
            {
                '@graph': {
                    $push: action.toJsonLD(),
                },
            },
        );
    });

    it('uses model url container on find', async () => {
        class StubModel extends SolidModel {
        }

        const containerUrl = Url.resolveDirectory(Faker.internet.url());

        jest.spyOn(engine, 'readOne');

        Soukai.loadModels({ StubModel });

        await StubModel.find(Url.resolve(containerUrl, Faker.random.uuid()));

        const collection = (engine.readOne as any).mock.calls[0][0];

        expect(collection).toEqual(containerUrl);
    });

    it('uses model url container on save', async () => {
        class StubModel extends SolidModel {
        }

        const containerUrl = Url.resolveDirectory(Faker.internet.url());

        jest.spyOn(engine, 'update');

        Soukai.loadModels({ StubModel });

        const model = new StubModel(
            { url: Url.resolve(containerUrl, Faker.random.uuid()) },
            true,
        );

        await model.update({ name: 'John' });

        const collection = (engine.update as any).mock.calls[0][0];

        expect(collection).toEqual(containerUrl);
    });

    it('uses model url container on delete', async () => {
        class StubModel extends SolidModel {
        }

        const containerUrl = Url.resolveDirectory(Faker.internet.url());

        jest.spyOn(engine, 'delete');

        Soukai.loadModels({ StubModel });

        const model = new StubModel(
            { url: Url.resolve(containerUrl, Faker.random.uuid()) },
            true,
        );

        await model.delete();

        const collection = (engine.delete as any).mock.calls[0][0];

        expect(collection).toEqual(containerUrl);
    });

    it('aliases url attribute as id', async () => {
        class StubModel extends SolidModel {
        }

        Soukai.loadModels({ StubModel });

        const model = new StubModel();

        await model.save();

        expect(model.url).toBeTruthy();
        expect(model.url).toEqual(model.id);
    });

    it('implements belongs to many relationship', async () => {
        // Arrange
        jest.spyOn(engine, 'readMany');

        engine.setMany('https://example.com/', {
            'https://example.com/alice': stubPersonJsonLD('https://example.com/alice', 'Alice'),
        });

        engine.setMany('https://example.org/', {
            'https://example.org/bob':  stubPersonJsonLD('https://example.org/bob', 'Bob'),
        });

        const john = new Person({
            name: 'John',
            friendUrls: [
                'https://example.com/alice',
                'https://example.org/bob',
            ],
        });

        // Act
        await john.loadRelation('friends');

        // Assert
        expect(john.friends).toHaveLength(2);
        expect(john.friends[0]).toBeInstanceOf(Person);
        expect(john.friends[0].url).toBe('https://example.com/alice');
        expect(john.friends[0].name).toBe('Alice');
        expect(john.friends[1]).toBeInstanceOf(Person);
        expect(john.friends[1].url).toBe('https://example.org/bob');
        expect(john.friends[1].name).toBe('Bob');

        expect(engine.readMany).toHaveBeenCalledTimes(2);
        expect(engine.readMany).toHaveBeenCalledWith(
            'https://example.com/',
            {
                $in: [
                    'https://example.com/alice',
                ],
                '@graph': {
                    $contains: {
                        '@type': {
                            $or: [
                                { $contains: ['Person'] },
                                { $contains: ['http://xmlns.com/foaf/0.1/Person'] },
                                { $eq: 'Person' },
                                { $eq: 'http://xmlns.com/foaf/0.1/Person' },
                            ],
                        },
                    },
                },
            },
        );
        expect(engine.readMany).toHaveBeenCalledWith(
            'https://example.org/',
            {
                $in: [
                    'https://example.org/bob',
                ],
                '@graph': {
                    $contains: {
                        '@type': {
                            $or: [
                                { $contains: ['Person'] },
                                { $contains: ['http://xmlns.com/foaf/0.1/Person'] },
                                { $eq: 'Person' },
                                { $eq: 'http://xmlns.com/foaf/0.1/Person' },
                            ],
                        },
                    },
                },
            },
        );
    });

    it('loads related models in the same document', async () => {
        // Arrange
        const movieUrl = Url.resolve(Faker.internet.url());
        const watchActionUrl = `${movieUrl}#${Faker.random.uuid()}`;

        engine.setOne({
            '@graph': [
                ...stubMovieJsonLD(movieUrl, Faker.lorem.sentence())['@graph'],
                ...stubWatchActionJsonLD(watchActionUrl, movieUrl)['@graph'],
            ],
        });

        // Act
        const movie = await Movie.find(movieUrl) as Movie;

        // Assert
        expect(movie.actions).toHaveLength(1);

        const watchAction = movie.actions![0];
        expect(watchAction).toBeInstanceOf(WatchAction);
        expect(watchAction.object).toBe(movieUrl);
        expect(watchAction.exists()).toBe(true);
    });

    it('implements is contained by relationship', async () => {
        // Arrange
        const name = Faker.random.word();
        const containerUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(name));
        const person = new Person({
            url: Url.resolve(containerUrl, Faker.random.uuid()),
        });

        jest.spyOn(engine, 'readOne');
        jest.spyOn(engine, 'readMany');

        engine.setOne(stubGroupJsonLD(containerUrl, name));

        expect(person.group).toBeUndefined();

        // Act
        await person.loadRelation('group');

        // Assert
        expect(person.group).toBeInstanceOf(Group);
        expect(person.group.name).toBe(name);

        expect(engine.readOne).toHaveBeenCalledWith(Url.parentDirectory(containerUrl), containerUrl);
    });

    it('serializes to JSON-LD', () => {
        // Arrange
        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const name = Faker.random.word();
        const person = new Person({
            name,
            url: Url.resolve(containerUrl, Faker.random.uuid()),
            friendUrls: [
                Url.resolve(containerUrl, Faker.random.uuid()),
                Url.resolve(containerUrl, Faker.random.uuid()),
                Url.resolve(containerUrl, Faker.random.uuid()),
            ],
            createdAt: new Date('1997-07-21T23:42:00Z'),
        });

        // Act
        const jsonld = person.toJsonLD();

        // Assert
        expect(jsonld).toEqual({
            '@id': person.url,
            '@context': {
                '@vocab': 'http://xmlns.com/foaf/0.1/',
                'purl': 'http://purl.org/dc/terms/',
            },
            '@type': 'Person',
            'name': name,
            'knows': person.friendUrls.map(url => ({ '@id': url })),
            'purl:created': {
                '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
                '@value': '1997-07-21T23:42:00.000Z',
            }
        });
    });

    it('serializes to JSON-LD with relations', () => {
        // Arrange
        const movieName = Faker.name.title();
        const movieUrl = Url.resolve(Faker.internet.url(), Str.slug(movieName));
        const watchActionUrl = `${movieUrl}#${Faker.random.uuid()}`;
        const movie = new Movie({ url: movieUrl, name: movieName });

        movie.setRelationModels('actions', [
            new WatchAction({
                url: watchActionUrl,
                object: movieUrl,
                startTime: new Date('1997-07-21T23:42:00Z'),
            }),
        ]);

        // Act
        const jsonld = movie.toJsonLD();

        // Assert
        expect(jsonld).toEqual({
            '@context': {
                '@vocab': 'https://schema.org/',
                'actions': { '@reverse': 'object' },
            },
            '@type': 'Movie',
            '@id': movieUrl,
            'name': movieName,
            'actions': [
                {
                    '@type': 'WatchAction',
                    '@id': watchActionUrl,
                    'startTime': {
                        '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
                        '@value': '1997-07-21T23:42:00.000Z',
                    },
                },
            ],
        });
    });

    it('parses JSON-LD', async () => {
        // Arrange
        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const name = Faker.random.word();
        const url = Url.resolve(containerUrl, Faker.random.uuid());
        const friendUrls = [
            Url.resolve(containerUrl, Faker.random.uuid()),
            Url.resolve(containerUrl, Faker.random.uuid()),
            Url.resolve(containerUrl, Faker.random.uuid()),
        ];

        // Act
        const person = await Person.newFromJsonLD({
            '@context': { '@vocab': 'http://xmlns.com/foaf/0.1/' },
            '@id': url,
            '@type': [
                'http://xmlns.com/foaf/0.1/Person',
            ],
            name,
            knows: friendUrls.map(url => ({ '@id': url })),
            'http://purl.org/dc/terms/created': {
                '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
                '@value': '1997-07-21T23:42:00.000Z',
            },
        });

        // Assert
        expect(person.exists()).toEqual(false);
        expect(person.name).toEqual(name);
        expect(person.url).toEqual(url);
        expect(person.friendUrls).toEqual(friendUrls);
        expect(person.createdAt).toBeInstanceOf(Date);
        expect(person.createdAt.toISOString()).toEqual('1997-07-21T23:42:00.000Z');
    });

});
