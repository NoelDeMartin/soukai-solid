import Faker from 'faker';

import Soukai, { FieldType } from 'soukai';

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
        Soukai.loadModel('Group', Group);
        Soukai.loadModel('Person', Person);
        Soukai.loadModel('Movie', Movie);
        Soukai.loadModel('WatchAction', WatchAction);
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

        Soukai.loadModel('StubModel', StubModel);

        expect(StubModel.rdfsClasses).toEqual(new Set([
            'http://xmlns.com/foaf/0.1/Person',
            'http://www.w3.org/ns/ldp#Resource',
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

    it('adds ldp:Resource to models', () => {
        class StubModel extends SolidModel {
        }

        Soukai.loadModel('StubModel', StubModel);

        expect(StubModel.rdfsClasses).toEqual(new Set([
            'http://www.w3.org/ns/ldp#Resource',
        ]));
    });

    it('adds ldp:Container to container models', () => {
        class StubModel extends SolidModel {

            public static ldpContainer = true;

        }

        Soukai.loadModel('StubModel', StubModel);

        expect(StubModel.rdfsClasses).toEqual(new Set([
            'http://www.w3.org/ns/ldp#Resource',
            'http://www.w3.org/ns/ldp#Container',
        ]));
    });

    it('adds resourceUrls to container models', () => {
        class StubModel extends SolidModel {

            public static timestamps = false;

            public static ldpContainer = true;

        }

        Soukai.loadModel('StubModel', StubModel);

        expect(StubModel.fields).toEqual({
            url: {
                type: FieldType.Key,
                required: false,
                rdfProperty: null,
            },
            resourceUrls: {
                type: FieldType.Array,
                required: false,
                rdfProperty: 'http://www.w3.org/ns/ldp#contains',
                items: {
                    type: FieldType.Key,
                },
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

        Soukai.loadModel('StubModel', StubModel);

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

        Soukai.loadModel('StubModel', StubModel);

        await StubModel.at(containerUrl).create({ nickname: 'Johnny' });

        const attributes = (engine.create as any).mock.calls[0][1];

        expect(attributes['http://www.w3.org/ns/solid/terms#nickname']).toEqual('Johnny');
    });

    it('serializes types on create', async () => {
        class StubModel extends SolidModel {
        }

        jest.spyOn(engine, 'create');

        Soukai.loadModel('StubModel', StubModel);

        await StubModel.create({});

        const attributes = (engine.create as any).mock.calls[0][1];

        expect(attributes['@type']).not.toBeUndefined();
    });

    it("doesn't serialize types on update", async () => {
        class StubModel extends SolidModel {
        }

        jest.spyOn(engine, 'update');

        Soukai.loadModel('StubModel', StubModel);

        const model = new StubModel(
            { url: Url.resolve(Faker.internet.url(), Faker.random.uuid()) },
            true,
        );

        await model.update({ name: 'John' });

        const attributes = (engine.update as any).mock.calls[0][2];

        expect(attributes['@type']).toBeUndefined();
    });

    it('reads many from a directory', async () => {
        class StubModel extends SolidModel {
        }

        const containerUrl = Url.resolveDirectory(Faker.internet.url());

        jest.spyOn(engine, 'readMany');

        Soukai.loadModel('StubModel', StubModel);

        await StubModel.at(containerUrl).all();

        expect(engine.readMany).toHaveBeenCalledWith(containerUrl, expect.anything());
    });

    it('reads many from a document', async () => {
        class StubModel extends SolidModel {
        }

        const documentUrl = Url.resolve(Faker.internet.url(), Faker.random.word());

        jest.spyOn(engine, 'readMany');

        Soukai.loadModel('StubModel', StubModel);

        await StubModel.at(documentUrl).all();

        expect(engine.readMany).toHaveBeenCalledWith(documentUrl, expect.anything());
    });

    it('mints url for new models', async () => {
        class StubModel extends SolidModel {
        }

        const containerUrl = Url.resolveDirectory(Faker.internet.url());

        jest.spyOn(engine, 'create');

        Soukai.loadModel('StubModel', StubModel);

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

        Soukai.loadModel('StubModel', StubModel);

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

        Soukai.loadModel('StubModel', StubModel);

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

        Soukai.loadModel('StubModel', StubModel);

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

    it('uses name for minting url for new containers', async () => {
        class StubModel extends SolidModel {
            public static ldpContainer = true;

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

        Soukai.loadModel('StubModel', StubModel);

        const model = await StubModel.at(containerUrl).create({ name });

        expect(typeof model.url).toEqual('string');
        expect(model.url).toEqual(Url.resolveDirectory(containerUrl, Str.slug(name)));

        expect(engine.create).toHaveBeenCalledWith(
            containerUrl,
            expect.anything(),
            model.url,
        );
    });

    it('uses hash fragment for minting non ldp resource urls', async () => {
        class StubModel extends SolidModel {
            public static ldpResource = false;
        }

        const parentUrl = Url.resolve(Faker.internet.url(), Faker.random.uuid());

        jest.spyOn(engine, 'create');

        Soukai.loadModel('StubModel', StubModel);

        const model = new StubModel();

        await model.save(parentUrl);

        expect(typeof model.url).toEqual('string');
        expect(model.url.startsWith(parentUrl + '#')).toBe(true);

        expect(engine.create).toHaveBeenCalledWith(
            parentUrl,
            expect.anything(),
            model.url,
        );
    });

    it('uses model url container on find', async () => {
        class StubModel extends SolidModel {
        }

        const containerUrl = Url.resolveDirectory(Faker.internet.url());

        jest.spyOn(engine, 'readOne');

        Soukai.loadModel('StubModel', StubModel);

        await StubModel.find(Url.resolve(containerUrl, Faker.random.uuid()));

        const collection = (engine.readOne as any).mock.calls[0][0];

        expect(collection).toEqual(containerUrl);
    });

    it('uses model url container on save', async () => {
        class StubModel extends SolidModel {
        }

        const containerUrl = Url.resolveDirectory(Faker.internet.url());

        jest.spyOn(engine, 'update');

        Soukai.loadModel('StubModel', StubModel);

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

        Soukai.loadModel('StubModel', StubModel);

        const model = new StubModel(
            { url: Url.resolve(containerUrl, Faker.random.uuid()) },
            true,
        );

        await model.delete();

        const collection = (engine.delete as any).mock.calls[0][0];

        expect(collection).toEqual(containerUrl);
    });

    it('uses parent document url on save for non ldp resources', async () => {
        class StubModel extends SolidModel {
            public static ldpResource = false;
        }

        const parentUrl = Url.resolve(Faker.internet.url(), Faker.random.uuid());

        jest.spyOn(engine, 'update');

        Soukai.loadModel('StubModel', StubModel);

        const model = new StubModel(
            { url: parentUrl + '#' + Faker.random.uuid() },
            true,
        );

        await model.update({ name: 'John' });

        const collection = (engine.update as any).mock.calls[0][0];

        expect(collection).toEqual(parentUrl);
    });

    it('aliases url attribute as id', async () => {
        class StubModel extends SolidModel {
        }

        Soukai.loadModel('StubModel', StubModel);

        const model = new StubModel();

        await model.save();

        expect(model.url).toBeTruthy();
        expect(model.url).toEqual(model.id);
    });

    it('sends JsonLD to engines', async () => {
        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const name = Faker.random.word();
        const friendUrls = [
            Faker.internet.url(),
            Faker.internet.url(),
            Faker.internet.url(),
        ];

        jest.spyOn(engine, 'create');

        Soukai.loadModel('Person', Person);

        const model = await Person.at(containerUrl).create({
            name,
            friendUrls,
            createdAt: new Date('1997-07-21T23:42:00Z'),
        });

        const attributes = (engine.create as any).mock.calls[0][1];

        expect(attributes).toEqual({
            '@id': model.url,
            '@type': [
                { '@id': 'http://xmlns.com/foaf/0.1/Person' },
                { '@id': 'http://www.w3.org/ns/ldp#Resource' },
            ],
            'http://xmlns.com/foaf/0.1/name': name,
            'http://xmlns.com/foaf/0.1/knows': friendUrls.map(
                url => ({ '@id': url }),
            ),
            // TODO JSONLD is not supposed to contain native dates
            'http://purl.org/dc/terms/created': new Date('1997-07-21T23:42:00.000Z'),
        });
    });

    it('implements has many relationship', async () => {
        Soukai.loadModel('Person', Person);

        jest.spyOn(engine, 'readMany');

        engine.setMany('https://example.com/', {
            'https://example.com/alice': stubPersonJsonLD('https://example.com/alice', 'Alice'),
        });

        engine.setMany('https://example.org/', {
            'https://example.org/bob': stubPersonJsonLD('https://example.org/bob', 'Bob'),
        });

        const john = new Person({
            name: 'John',
            friendUrls: [
                'https://example.com/alice',
                'https://example.org/bob',
            ],
        });

        await john.loadRelation('friends');

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
                '@type': {
                    $contains: [
                        { '@id': 'http://xmlns.com/foaf/0.1/Person' },
                        { '@id': 'http://www.w3.org/ns/ldp#Resource' },
                    ],
                },
            },
        );
        expect(engine.readMany).toHaveBeenCalledWith(
            'https://example.org/',
            {
                $in: [
                    'https://example.org/bob',
                ],
                '@type': {
                    $contains: [
                        { '@id': 'http://xmlns.com/foaf/0.1/Person' },
                        { '@id': 'http://www.w3.org/ns/ldp#Resource' },
                    ],
                },
            },
        );
    });

    it('implements contains relationship', async () => {
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

        jest.spyOn(engine, 'readMany');

        engine.setMany(containerUrl, {
            [musashiUrl]: stubPersonJsonLD(musashiUrl, 'Musashi'),
            [kojiroUrl]: stubPersonJsonLD(kojiroUrl, 'Kojiro'),
        });

        expect(group.members).toBeUndefined();

        await group.loadRelation('members');

        expect(group.members).toHaveLength(2);
        expect(group.members[0]).toBeInstanceOf(Person);
        expect(group.members[0].url).toBe(musashiUrl);
        expect(group.members[0].name).toBe('Musashi');
        expect(group.members[1]).toBeInstanceOf(Person);
        expect(group.members[1].url).toBe(kojiroUrl);
        expect(group.members[1].name).toBe('Kojiro');

        expect(engine.readMany).toHaveBeenCalledTimes(1);
        expect(engine.readMany).toHaveBeenCalledWith(
            containerUrl,
            {
                $in: [
                    musashiUrl,
                    kojiroUrl,
                ],
                '@type': {
                    $contains: [
                        { '@id': 'http://xmlns.com/foaf/0.1/Person' },
                        { '@id': 'http://www.w3.org/ns/ldp#Resource' },
                    ],
                },
            },
        );
    });

    it('implements embeds relationship', async () => {
        const movieUrl = Url.resolve(Faker.internet.url());
        const watchActionUrl = `${movieUrl}#${Faker.random.uuid()}`;

        const movie = new Movie({url: movieUrl});

        jest.spyOn(engine, 'readMany');

        engine.setMany(movieUrl, {
            [watchActionUrl]: stubWatchActionJsonLD(watchActionUrl, movieUrl),
        });

        expect(movie.actions).toBeUndefined();

        await movie.loadRelation('actions');

        expect(movie.actions).toHaveLength(1);
        expect(movie.actions[0]).toBeInstanceOf(WatchAction);
        expect(movie.actions[0].object).toBe(movieUrl);

        expect(engine.readMany).toHaveBeenCalledTimes(1);
        expect(engine.readMany).toHaveBeenCalledWith(
            movieUrl,
            {
                '@type': {
                    $or: [
                        { $contains: [{ '@id': 'https://schema.org/WatchAction' }] },
                        { $eq: { '@id': 'https://schema.org/WatchAction' } },
                    ],
                },
            },
        );
    });

    it('eager loads embedded models', async () => {
        const movieUrl = Url.resolve(Faker.internet.url());
        const watchActionUrl = `${movieUrl}#${Faker.random.uuid()}`;

        engine.setOne({
            ...stubMovieJsonLD(movieUrl, Faker.lorem.sentence()),
            __embedded: {
                [watchActionUrl]: stubWatchActionJsonLD(watchActionUrl, movieUrl),
            },
        });

        const movie = await Movie.find(movieUrl) as Movie;

        expect(movie.actions).toHaveLength(1);
        expect(movie.actions[0]).toBeInstanceOf(WatchAction);
        expect(movie.actions[0].object).toBe(movieUrl);
    });

    it('implements is contained by relationship', async () => {
        const name = Faker.random.word();
        const containerUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(name));
        const person = new Person({
            url: Url.resolve(containerUrl, Faker.random.uuid()),
        });

        jest.spyOn(engine, 'readOne');

        engine.setOne(stubGroupJsonLD(containerUrl, name));

        expect(person.group).toBeUndefined();

        await person.loadRelation('group');

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
        const json = person.toJSONLD();

        // Assert
        expect(json).toEqual({
            '@id': person.url,
            '@context': {
                '@vocab': 'http://xmlns.com/foaf/0.1/',
                'ldp': 'http://www.w3.org/ns/ldp#',
                'purl': 'http://purl.org/dc/terms/',
            },
            '@type': [
                'Person',
                'ldp:Resource',
            ],
            'name': name,
            'knows': person.friendUrls,
            'purl:created': {
                '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
                '@value': '1997-07-21T23:42:00.000Z',
            }
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
        const person = await Person.fromJSONLD({
            '@context': { '@vocab': 'http://xmlns.com/foaf/0.1/' },
            '@id': url,
            '@type': [
                'http://xmlns.com/foaf/0.1/Person',
                'http://www.w3.org/ns/ldp#Resource',
            ],
            name,
            knows: friendUrls,
            'http://purl.org/dc/terms/created': {
                '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
                '@value': '1997-07-21T23:42:00.000Z',
            },
        });

        // Assert
        expect(person.name).toEqual(name);
        expect(person.url).toEqual(url);
        expect(person.friendUrls).toEqual(friendUrls);
        expect(person.createdAt).toBeInstanceOf(Date);
        expect(person.createdAt.toISOString()).toEqual('1997-07-21T23:42:00.000Z');
    });

});
