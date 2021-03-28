import Faker from 'faker';

import Soukai, { FieldType } from 'soukai';

import { IRI } from '@/solid/utils/RDF';

import Str from '@/utils/Str';
import Url from '@/utils/Url';

import { stubPersonJsonLD, stubGroupJsonLD, stubWatchActionJsonLD, stubMovieJsonLD } from '@tests/stubs/helpers';
import Group from '@tests/stubs/Group';
import Movie from '@tests/stubs/Movie';
import MoviesCollection from '@tests/stubs/MoviesCollection';
import Person from '@tests/stubs/Person';
import StubEngine from '@tests/stubs/StubEngine';
import WatchAction from '@tests/stubs/WatchAction';

import SolidModel from './SolidModel';

let engine: StubEngine;

describe('SolidModel', () => {

    beforeAll(() => {
        Soukai.loadModels({
            Group,
            Movie,
            MoviesCollection,
            Person,
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
        const action = await movie.relatedActions.create({ startTime: new Date('1997-07-21T23:42:00Z') });

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
        expect(typeof movie.actions![0].url).toEqual('string');
        expect(movie.actions![0].exists()).toBe(true);
        expect(movie.actions![0].url.startsWith(`${movieUrl}#`)).toBe(true);
        expect(movie.actions![0].object).toEqual(movieUrl);
    });

    it('sends JSON-LD with related models in the same document without minted url', async () => {
        // Arrange
        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const movieName = Faker.name.title();
        const movie = new Movie({ name: movieName });
        const action = await movie.relatedActions.create({ startTime: new Date('1997-07-21T23:42:00Z') });

        jest.spyOn(engine, 'create');

        // Act
        await movie.save(containerUrl);

        // Assert
        expect(engine.create).toHaveBeenCalledWith(
            containerUrl,
            expect.anything(),
            movie.getDocumentUrl(),
        );
        expect((engine.create as any).mock.calls[0][1]).toEqualJsonLD({
            '@graph': [
                ...stubMovieJsonLD(movie.url, movieName)['@graph'],
                ...stubWatchActionJsonLD(action.url, movie.url, '1997-07-21T23:42:00.000Z')['@graph'],
            ],
        });

        expect(movie.exists()).toBe(true);
        expect(movie.documentExists()).toBe(true);
        expect(movie.url.startsWith(containerUrl)).toBe(true);
        expect(movie.actions![0].exists()).toBe(true);
        expect(movie.actions![0].documentExists()).toBe(true);
        expect(movie.actions![0].url.startsWith(`${movie.getDocumentUrl()}#`)).toBe(true);
        expect(movie.actions![0].object).toEqual(movie.url);
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
            model.getDocumentUrl(),
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

    it('reads many from multiple documents with related models', async () => {
        // Arrange
        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const firstDocumentUrl = Url.resolve(containerUrl, Faker.random.uuid());
        const secondDocumentUrl = Url.resolve(containerUrl, Faker.random.uuid());
        const firstMovieUrl = `${firstDocumentUrl}#it`;
        const secondMovieUrl = `${secondDocumentUrl}#it`;
        const thirdMovieUrl = `${secondDocumentUrl}#${Faker.random.uuid()}`;
        const firstWatchActionUrl = `${secondDocumentUrl}#${Faker.random.uuid()}`;
        const secondWatchActionUrl = `${secondDocumentUrl}#${Faker.random.uuid()}`;
        const firstMovieName = Faker.name.title();
        const secondMovieName = Faker.name.title();
        const thirdMovieName = Faker.name.title();
        const collection = new MoviesCollection({ url: containerUrl }, true);

        engine.setMany(containerUrl, {
            [firstDocumentUrl]: stubMovieJsonLD(firstMovieUrl, firstMovieName),
            [secondDocumentUrl]: {
                '@graph': [
                    stubMovieJsonLD(secondMovieUrl, secondMovieName)['@graph'][0],
                    stubMovieJsonLD(thirdMovieUrl, thirdMovieName)['@graph'][0],
                    stubWatchActionJsonLD(firstWatchActionUrl, secondMovieUrl)['@graph'][0],
                    stubWatchActionJsonLD(secondWatchActionUrl, thirdMovieUrl)['@graph'][0],
                ],
            },
        });

        // Act
        await collection.loadRelation('movies');

        // Assert
        expect(collection.movies).toHaveLength(3);

        expect(collection.movies![0].url).toEqual(firstMovieUrl);
        expect(collection.movies![0].name).toEqual(firstMovieName);
        expect(collection.movies![0].actions).toHaveLength(0);

        expect(collection.movies![1].url).toEqual(secondMovieUrl);
        expect(collection.movies![1].name).toEqual(secondMovieName);
        expect(collection.movies![1].actions).toHaveLength(1);
        expect(collection.movies![1].actions![0].url).toEqual(firstWatchActionUrl);
        expect(collection.movies![1].actions![0].getSourceDocumentUrl()).toEqual(secondDocumentUrl);

        expect(collection.movies![2].url).toEqual(thirdMovieUrl);
        expect(collection.movies![2].name).toEqual(thirdMovieName);
        expect(collection.movies![2].actions).toHaveLength(1);
        expect(collection.movies![2].actions![0].url).toEqual(secondWatchActionUrl);
        expect(collection.movies![2].actions![0].getSourceDocumentUrl()).toEqual(secondDocumentUrl);
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
            model.getDocumentUrl(),
        );
    });

    it('Uses default hash to mint urls for new models', async () => {
        // Arrange
        class StubModel extends SolidModel {
            static defaultResourceHash = 'foobar';
        }

        const containerUrl = Url.resolveDirectory(Faker.internet.url());

        jest.spyOn(engine, 'create');

        Soukai.loadModels({ StubModel });

        // Act
        const model = await StubModel.at(containerUrl).create();

        // Assert
        expect(typeof model.url).toEqual('string');
        expect(model.url.startsWith(containerUrl)).toBe(true);
        expect(model.url.endsWith('#foobar')).toBe(true);

        expect(engine.create).toHaveBeenCalledWith(
            containerUrl,
            expect.anything(),
            model.getDocumentUrl(),
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

    it('mints unique urls when urls are already in use', async () => {
        // Arrange
        class StubModel extends SolidModel {
        }

        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const escapedContainerUrl = containerUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const resourceUrl = Url.resolve(containerUrl, Str.slug(Faker.random.word()));

        engine.setOne({ url: resourceUrl });
        jest.spyOn(engine, 'create');

        Soukai.loadModels({ StubModel });

        // Act
        const model = new StubModel({ url: resourceUrl });

        await model.save(containerUrl);

        // Assert
        expect(typeof model.url).toEqual('string');
        expect(model.url).not.toEqual(resourceUrl);
        expect(model.url).toMatch(new RegExp(`^${escapedContainerUrl}[\\d\\w-]+$`))
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
            model.getDocumentUrl(),
        );
    });

    it('uses hash fragment for minting model urls in the same document', async () => {
        // Arrange
        const movieUrl = Url.resolve(Faker.internet.url(), Faker.random.uuid());
        const movie = new Movie({ url: movieUrl }, true);

        movie.setRelationModels('actions', []);

        jest.spyOn(engine, 'update');

        // Act
        const action = await movie.relatedActions.create({});

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

    it('creates models in existing documents', async () => {
        // Arrange
        const documentUrl = Url.resolve(Faker.internet.url(), Faker.random.uuid());
        const movieUrl = documentUrl + '#' + Faker.random.uuid();
        const movie = new Movie({ url: movieUrl });

        movie.setDocumentExists(true);
        jest.spyOn(engine, 'update');

        // Act
        await movie.save();

        // Assert
        expect(engine.update).toHaveBeenCalledWith(
            expect.anything(),
            documentUrl,
            {
                '@graph': {
                    $push: movie.toJsonLD(),
                },
            },
        );
    });

    it('updates models', async () => {
        // Arrange
        const documentUrl = Url.resolve(Faker.internet.url(), Faker.random.uuid());
        const movieName = Faker.name.title();
        const movieUrl = documentUrl + '#' + Faker.random.uuid();
        const movie = new Movie({ url: movieUrl }, true);

        movie.title = movieName;

        jest.spyOn(engine, 'update');

        // Act
        await movie.save();

        // Assert
        expect(engine.update).toHaveBeenCalledWith(
            expect.anything(),
            documentUrl,
            {
                '@graph': {
                    $updateItems: {
                        $where: { '@id': movieUrl },
                        $update: { [IRI('schema:title')]: movieName },
                    },
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

    it('deletes the entire document if all stored resources are deleted', async () => {
        // Arrange
        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const documentUrl = Url.resolve(containerUrl, Faker.random.uuid());
        const movieUrl = `${documentUrl}#it`;
        const actionUrl = `${documentUrl}#action`;
        const movie = new Movie({ url: movieUrl }, true);

        movie.setRelationModels('actions', [new WatchAction({ url: actionUrl }, true)]);

        engine.setMany(containerUrl, {
            [documentUrl]: {
                '@graph': [
                    { '@id': movieUrl },
                    { '@id': actionUrl },
                ],
            },
        });

        jest.spyOn(engine, 'delete');

        // Act
        await movie.delete();

        // Assert
        expect(engine.delete).toHaveBeenCalledTimes(1);
        expect(engine.delete).toHaveBeenCalledWith(containerUrl, documentUrl);
    });

    it('deletes only model properties if the document has other resources', async () => {
        // Arrange
        class StubModel extends SolidModel {
        }
        Soukai.loadModels({ StubModel });
        jest.spyOn(engine, 'update');

        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const documentUrl = Url.resolve(containerUrl, Faker.random.uuid());
        const url = `${documentUrl}#it`;
        const model = new StubModel({ url, name: Faker.name.firstName() }, true);

        engine.setMany(containerUrl, {
            [documentUrl]: {
                '@graph': [
                    { '@id': `${documentUrl}#something-else` },
                ],
            },
        });

        // Act
        await model.delete();

        // Assert
        expect(engine.update).toHaveBeenCalledTimes(1);
        expect(engine.update).toHaveBeenCalledWith(
            containerUrl,
            documentUrl,
            {
                '@graph': {
                    $updateItems: {
                        $where: { '@id': { $in: [url] } },
                        $unset: true,
                    },
                },
            },
        );
    });

    it('deletes complex document structures properly', async () => {
        // Arrange - create models & urls
        const firstContainerUrl = Url.resolveDirectory(Faker.internet.url());
        const secondContainerUrl = Url.resolveDirectory(Faker.internet.url());
        const firstDocumentUrl = Url.resolve(firstContainerUrl, Faker.random.uuid());
        const secondDocumentUrl = Url.resolve(firstContainerUrl, Faker.random.uuid());
        const thirdDocumentUrl = Url.resolve(secondContainerUrl, Faker.random.uuid());
        const movieUrl = `${firstDocumentUrl}#it`;
        const firstActionUrl = `${firstDocumentUrl}#action`;
        const secondActionUrl = `${secondDocumentUrl}#it`;
        const thirdActionUrl = `${thirdDocumentUrl}#action-1`;
        const fourthActionUrl = `${thirdDocumentUrl}#action-2`;
        const movie = new Movie({ url: movieUrl }, true);

        movie.setRelationModels('actions', [
            new WatchAction({ url: firstActionUrl }, true),
            new WatchAction({ url: secondActionUrl }, true),
            new WatchAction({ url: thirdActionUrl }, true),
            new WatchAction({ url: fourthActionUrl }, true),
        ]);

        // Arrange - set up engine
        engine.setMany(firstContainerUrl, {
            [firstDocumentUrl]: {
                '@graph': [
                    { '@id': movieUrl },
                    { '@id': firstActionUrl },
                ],
            },
            [secondDocumentUrl]: {
                '@graph': [
                    { '@id': secondActionUrl },
                ],
            }
        });

        engine.setMany(secondContainerUrl, {
            [thirdDocumentUrl]: {
                '@graph': [
                    { '@id': thirdActionUrl },
                    { '@id': fourthActionUrl },
                    { '@id': `${thirdDocumentUrl}#somethingelse` },
                ],
            },
        });

        jest.spyOn(engine, 'update');
        jest.spyOn(engine, 'delete');

        // Act
        await movie.delete();

        // Assert
        expect(engine.delete).toHaveBeenCalledTimes(2);
        expect(engine.delete).toHaveBeenCalledWith(firstContainerUrl, firstDocumentUrl);
        expect(engine.delete).toHaveBeenCalledWith(firstContainerUrl, secondDocumentUrl);

        expect(engine.update).toHaveBeenCalledTimes(1);
        expect(engine.update).toHaveBeenCalledWith(secondContainerUrl, thirdDocumentUrl, {
            '@graph': {
                $updateItems: {
                    $where: { '@id': { $in: [thirdActionUrl, fourthActionUrl] } },
                    $unset: true,
                },
            },
        });
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
        const friendUrls = [
            Url.resolve(containerUrl, Faker.random.uuid()),
            Url.resolve(containerUrl, Faker.random.uuid()),
            Url.resolve(containerUrl, Faker.random.uuid()),
        ];

        // Act
        const person = await Person.newFromJsonLD({
            '@context': { '@vocab': 'http://xmlns.com/foaf/0.1/' },
            '@id': Url.resolve(containerUrl, Faker.random.uuid()),
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
        expect(person.url).toBeUndefined();
        expect(person.friendUrls).toEqual(friendUrls);
        expect(person.createdAt).toBeInstanceOf(Date);
        expect(person.createdAt.toISOString()).toEqual('1997-07-21T23:42:00.000Z');
    });

    it('parses JSON-LD with related models', async () => {
        // Arrange
        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const name = Faker.random.word();
        const documentUrl = Url.resolve(containerUrl, Faker.random.uuid());
        const url = `${documentUrl}#it`;

        // Act
        const movie = await Movie.newFromJsonLD<Movie>({
            '@context': {
                '@vocab': 'https://schema.org/',
                'actions': { '@reverse': 'object' },
            },
            '@id': url,
            '@type': 'Movie',
            'name': name,
            'actions': [
                {
                    '@id': `${documentUrl}#action`,
                    '@type': 'WatchAction',
                },
            ],
        });

        // Assert
        expect(movie.exists()).toBe(false);
        expect(movie.name).toEqual(name);
        expect(movie.url).toBeUndefined();
        expect(movie.actions).toHaveLength(1);
        expect(movie.actions![0]).toBeInstanceOf(WatchAction);
        expect(movie.actions![0].exists()).toBe(false);
        expect(movie.actions![0].url).toBeUndefined();
        expect(movie.actions![0].object).toBeUndefined();

        expect(movie.relatedActions.__modelsInSameDocument).toHaveLength(0);

        expect(movie.relatedActions.__newModels).toHaveLength(1);
        expect(movie.relatedActions.__newModels[0]).toBe(movie.actions![0]);
    });

});
