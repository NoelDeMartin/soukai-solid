/* eslint-disable max-len */
import { FieldType, InMemoryEngine, bootModels, setEngine } from 'soukai';
import { after, stringToSlug, tt, urlParentDirectory, urlResolve, urlResolveDirectory } from '@noeldemartin/utils';
import Faker from 'faker';
import type { EngineDocument } from 'soukai';
import type { Equals, Expect } from '@noeldemartin/utils';

import IRI from '@/solid/utils/IRI';
import type { SolidModelOperation } from '@/models';

import { stubGroupJsonLD, stubMovieJsonLD, stubPersonJsonLD, stubWatchActionJsonLD } from '@/testing/lib/stubs/helpers';
import Group from '@/testing/lib/stubs/Group';
import Movie from '@/testing/lib/stubs/Movie';
import MoviesCollection from '@/testing/lib/stubs/MoviesCollection';
import Person from '@/testing/lib/stubs/Person';
import StubEngine from '@/testing/lib/stubs/StubEngine';
import WatchAction from '@/testing/lib/stubs/WatchAction';

import { SolidModel } from './SolidModel';

let engine: StubEngine;

describe('SolidModel', () => {

    beforeAll(() => bootModels({
        Group,
        Movie,
        MoviesCollection,
        Person,
        WatchAction,
    }));

    beforeEach(() => {
        engine = new StubEngine();

        setEngine(engine);
    });

    it('resolves contexts when booting', () => {
        class StubModel extends SolidModel {

            public static timestamps = false;

            public static rdfContexts = {
                foaf: 'http://xmlns.com/foaf/0.1/',
            };

            public static rdfsClasses = ['foaf:Person'];

            public static fields = {
                name: {
                    type: FieldType.String,
                    rdfProperty: 'foaf:givenname',
                },
            };

        }

        bootModels({ StubModel });

        expect(StubModel.rdfsClasses).toEqual([
            'http://xmlns.com/foaf/0.1/Person',
        ]);

        expect(StubModel.fields).toEqual({
            url: {
                type: FieldType.Key,
                required: false,
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
                foaf: 'http://xmlns.com/foaf/0.1/',
            };

            public static fields = {
                name: FieldType.String,
            };

        }

        bootModels({ StubModel });

        expect(StubModel.fields).toEqual({
            url: {
                type: FieldType.Key,
                required: false,
            },
            name: {
                type: FieldType.String,
                required: false,
                rdfProperty: 'http://xmlns.com/foaf/0.1/name',
            },
        });
    });

    it('allows adding undefined fields', async () => {
        class StubModel extends SolidModel {}

        const containerUrl = urlResolveDirectory(Faker.internet.url());
        const createSpy = jest.spyOn(engine, 'create');

        bootModels({ StubModel });

        await StubModel.at(containerUrl).create({ nickname: 'Johnny' });

        const document = createSpy.mock.calls[0][1] as { '@graph': { nickname: string }[] };

        expect(document['@graph'][0].nickname).toEqual('Johnny');
    });

    it('sends types on create', async () => {
        class StubModel extends SolidModel {}

        const createSpy = jest.spyOn(engine, 'create');

        bootModels({ StubModel });

        await StubModel.create({});

        const document = createSpy.mock.calls[0][1] as { '@graph': { '@type': string }[] };

        expect(document['@graph'][0]['@type']).not.toBeUndefined();
    });

    it('sends JSON-LD with related models in the same document', async () => {
        // Arrange
        const containerUrl = urlResolveDirectory(Faker.internet.url());
        const movieName = Faker.name.title();
        const directorName = Faker.name.firstName();
        const movieUrl = urlResolve(containerUrl, stringToSlug(movieName));
        const movie = new Movie({ url: movieUrl, name: movieName });
        const action = await movie.relatedActions.create({ startTime: new Date('1997-07-21T23:42:00Z') });
        const director = await movie.relatedDirector.create({
            name: directorName,
            createdAt: new Date('1998-07-21T23:42:00.000Z'),
        });

        action.setRelationModel('movie', movie);

        const createSpy = jest.spyOn(engine, 'create');

        // Act
        await movie.save(containerUrl);

        // Assert
        expect(engine.create).toHaveBeenCalledWith(
            containerUrl,
            expect.anything(),
            movieUrl,
        );

        const document = createSpy.mock.calls[0][1];
        await expect(document).toEqualJsonLD({
            '@graph': [
                ...stubMovieJsonLD(movieUrl, movieName)['@graph'],
                ...stubPersonJsonLD(director.url as string, directorName, {
                    directed: movieUrl,
                    createdAt: '1998-07-21T23:42:00.000Z',
                })['@graph'],
                ...stubWatchActionJsonLD(action.url as string, movieUrl, '1997-07-21T23:42:00.000Z')['@graph'],
            ],
        });

        expect(movie.exists()).toBe(true);

        const actions = movie.actions as WatchAction[];
        expect(typeof actions[0].url).toEqual('string');
        expect(actions[0].exists()).toBe(true);

        const actionUrl = actions[0].url as string;
        expect(actionUrl.startsWith(`${movieUrl}#`)).toBe(true);
        expect(actions[0].object).toEqual(movieUrl);

        const movieDirector = movie.director as Person;
        expect(movieDirector).toBeInstanceOf(Person);
        expect(movieDirector.name).toEqual(directorName);
        expect(movieDirector.directed).toEqual(movieUrl);
    });

    it('sends JSON-LD with related models in the same document without minted url', async () => {
        // Arrange
        const containerUrl = urlResolveDirectory(Faker.internet.url());
        const movieName = Faker.name.title();
        const movie = new Movie({ name: movieName });
        const action = await movie.relatedActions.create({ startTime: new Date('1997-07-21T23:42:00Z') });

        const createSpy = jest.spyOn(engine, 'create');

        // Act
        await movie.save(containerUrl);

        // Assert
        const movieUrl = movie.url as string;

        expect(engine.create).toHaveBeenCalledWith(
            containerUrl,
            expect.anything(),
            movie.getDocumentUrl(),
        );
        expect(createSpy.mock.calls[0][1]).toEqualJsonLD({
            '@graph': [
                ...stubMovieJsonLD(movieUrl, movieName)['@graph'],
                ...stubWatchActionJsonLD(action.url as string, movieUrl, '1997-07-21T23:42:00.000Z')['@graph'],
            ],
        });

        expect(movie.exists()).toBe(true);
        expect(movie.documentExists()).toBe(true);
        expect(movieUrl.startsWith(containerUrl)).toBe(true);

        const actions = movie.actions as WatchAction[];
        expect(actions[0].exists()).toBe(true);
        expect(actions[0].documentExists()).toBe(true);

        const url = actions[0].url as string;
        expect(url.startsWith(`${movie.getDocumentUrl()}#`)).toBe(true);
        expect(actions[0].object).toEqual(movie.url);
    });

    it('sends JSON-LD with related model updates using parent engine', async () => {
        // Arrange
        const containerUrl = urlResolveDirectory(Faker.internet.url());
        const documentUrl = urlResolve(containerUrl, Faker.random.uuid());
        const movieUrl = `${documentUrl}#it`;
        const actionUrl = `${documentUrl}#action`;
        const document = {
            '@graph': [
                ...stubMovieJsonLD(movieUrl, Faker.lorem.sentence())['@graph'],
                ...stubWatchActionJsonLD(actionUrl, movieUrl)['@graph'],
            ],
        } as EngineDocument;
        const movie = await Movie.createFromEngineDocument(movieUrl, document, movieUrl);
        const action = movie.actions?.[0] as WatchAction;
        const updateSpy = jest.spyOn(engine, 'update');

        engine.setOne(document);
        action.setEngine(new InMemoryEngine);

        // Act
        movie.name = Faker.lorem.sentence();
        action.startTime = new Date();

        await movie.save();

        // Assert
        expect(engine.update).toHaveBeenCalledWith(
            containerUrl,
            documentUrl,
            expect.anything(),
        );

        expect(updateSpy.mock.calls[0][2]).toEqual({
            '@graph': {
                $apply: [
                    {
                        $updateItems: {
                            $where: { '@id': actionUrl },
                            $update: {
                                [IRI('schema:startTime')]: {
                                    '@type': IRI('xsd:dateTime'),
                                    '@value': action.startTime.toISOString(),
                                },
                            },
                        },
                    },
                    {
                        $updateItems: {
                            $where: { '@id': movieUrl },
                            $update: { [IRI('schema:name')]: movie.name },
                        },
                    },
                ],
            },
        });
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
                },
            },
        );
    });

    it('converts updates to JSON-LD', async () => {
        // Arrange.
        class StubModel extends SolidModel {

            public static timestamps = false;

            public name?: string;
            public surname?: string;

        }

        jest.spyOn(engine, 'update');

        bootModels({ StubModel });

        const containerUrl = urlResolveDirectory(Faker.internet.url());
        const model = new StubModel(
            {
                url: urlResolve(containerUrl, Faker.random.uuid()),
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
        const containerUrl = urlResolveDirectory(Faker.internet.url());
        const firstDocumentUrl = urlResolve(containerUrl, Faker.random.uuid());
        const secondDocumentUrl = urlResolve(containerUrl, Faker.random.uuid());
        const firstMovieUrl = `${firstDocumentUrl}#it`;
        const secondMovieUrl = `${secondDocumentUrl}#it`;
        const thirdMovieUrl = `${secondDocumentUrl}#${Faker.random.uuid()}`;
        const firstWatchActionUrl = `${secondDocumentUrl}#${Faker.random.uuid()}`;
        const secondWatchActionUrl = `${secondDocumentUrl}#${Faker.random.uuid()}`;
        const firstMovieName = Faker.name.title();
        const secondMovieName = Faker.name.title();
        const thirdMovieName = Faker.name.title();
        const collection = new MoviesCollection({
            url: containerUrl,
            resourceUrls: [firstDocumentUrl, secondDocumentUrl],
        }, true);

        engine.setMany(containerUrl, {
            [firstDocumentUrl]: stubMovieJsonLD(firstMovieUrl, firstMovieName),
            [secondDocumentUrl]: {
                '@graph': [
                    stubMovieJsonLD(secondMovieUrl, secondMovieName)['@graph'][0],
                    stubMovieJsonLD(thirdMovieUrl, thirdMovieName)['@graph'][0],
                    stubWatchActionJsonLD(firstWatchActionUrl, secondMovieUrl)['@graph'][0],
                    stubWatchActionJsonLD(secondWatchActionUrl, thirdMovieUrl)['@graph'][0],
                ],
            } as EngineDocument,
        });

        // Act
        await collection.loadRelation('movies');

        // Assert
        const movies = collection.movies as Movie[];
        expect(movies).toHaveLength(3);

        const firstMovie = movies.find(movie => movie.url === firstMovieUrl) as Movie;
        expect(firstMovie).not.toBeNull();
        expect(firstMovie.name).toEqual(firstMovieName);
        expect(firstMovie.actions).toHaveLength(0);

        const secondMovie = movies.find(movie => movie.url === secondMovieUrl) as Movie;
        expect(secondMovie).not.toBeNull();
        expect(secondMovie.name).toEqual(secondMovieName);
        expect(secondMovie.actions).toHaveLength(1);

        const secondMovieActions = secondMovie.actions as WatchAction[];
        expect(secondMovieActions[0].url).toEqual(firstWatchActionUrl);
        expect(secondMovieActions[0].getSourceDocumentUrl()).toEqual(secondDocumentUrl);

        const thirdMovie = movies.find(movie => movie.url === thirdMovieUrl) as Movie;
        expect(thirdMovie).not.toBeNull();
        expect(thirdMovie.name).toEqual(thirdMovieName);
        expect(thirdMovie.actions).toHaveLength(1);

        const thirdMovieActions = thirdMovie.actions as WatchAction[];
        expect(thirdMovieActions[0].url).toEqual(secondWatchActionUrl);
        expect(thirdMovieActions[0].getSourceDocumentUrl()).toEqual(secondDocumentUrl);
    });

    it('mints url for new models', async () => {
        class StubModel extends SolidModel {}

        const containerUrl = urlResolveDirectory(Faker.internet.url());

        jest.spyOn(engine, 'create');

        bootModels({ StubModel });

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

            public static defaultResourceHash = 'foobar';

        }

        const containerUrl = urlResolveDirectory(Faker.internet.url());

        jest.spyOn(engine, 'create');

        bootModels({ StubModel });

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

    it('doesn\'t mint urls for new models if disabled', async () => {
        class StubModel extends SolidModel {

            public static mintsUrls = false;

        }

        const containerUrl = urlResolveDirectory(Faker.internet.url());

        jest.spyOn(engine, 'create');

        bootModels({ StubModel });

        await StubModel.at(containerUrl).create();

        expect(engine.create).toHaveBeenCalledWith(
            containerUrl,
            expect.anything(),
            undefined,
        );
    });

    it('mints unique urls when urls are already in use', async () => {
        // Arrange
        class StubModel extends SolidModel {}

        const containerUrl = urlResolveDirectory(Faker.internet.url());
        const escapedContainerUrl = containerUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const resourceUrl = urlResolve(containerUrl, stringToSlug(Faker.random.word()));

        engine.setOne({ url: resourceUrl });
        jest.spyOn(engine, 'create');

        bootModels({ StubModel });

        // Act
        const model = new StubModel({ url: resourceUrl });

        await model.save(containerUrl);

        // Assert
        expect(typeof model.url).toEqual('string');
        expect(model.url).not.toEqual(resourceUrl);
        expect(model.url).toMatch(new RegExp(`^${escapedContainerUrl}[\\d\\w-]+$`));
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
        class StubModel extends SolidModel {}

        const containerUrl = urlResolveDirectory(Faker.internet.url());

        jest.spyOn(engine, 'create');

        bootModels({ StubModel });

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
        const movieUrl = urlResolve(Faker.internet.url(), Faker.random.uuid());
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
        const documentUrl = urlResolve(Faker.internet.url(), Faker.random.uuid());
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
        const documentUrl = urlResolve(Faker.internet.url(), Faker.random.uuid());
        const movieName = Faker.name.title();
        const movieUrl = documentUrl + '#' + Faker.random.uuid();
        const movie = new Movie({ url: movieUrl }, true);

        movie.name = movieName;

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
                        $update: { [IRI('schema:name')]: movieName },
                    },
                },
            },
        );
    });

    it('uses model url container on find', async () => {
        class StubModel extends SolidModel {}

        const containerUrl = urlResolveDirectory(Faker.internet.url());
        const readOneSpy = jest.spyOn(engine, 'readOne');

        bootModels({ StubModel });

        await StubModel.find(urlResolve(containerUrl, Faker.random.uuid()));

        const collection = readOneSpy.mock.calls[0][0];

        expect(collection).toEqual(containerUrl);
    });

    it('uses model url container on save', async () => {
        class StubModel extends SolidModel {}

        const containerUrl = urlResolveDirectory(Faker.internet.url());
        const updateSpy = jest.spyOn(engine, 'update');

        bootModels({ StubModel });

        const model = new StubModel(
            { url: urlResolve(containerUrl, Faker.random.uuid()) },
            true,
        );

        await model.update({ name: 'John' });

        const collection = updateSpy.mock.calls[0]?.[0];

        expect(collection).toEqual(containerUrl);
    });

    it('deletes the entire document if all stored resources are deleted', async () => {
        // Arrange
        const containerUrl = urlResolveDirectory(Faker.internet.url());
        const documentUrl = urlResolve(containerUrl, Faker.random.uuid());
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
        class StubModel extends SolidModel {}
        bootModels({ StubModel });
        jest.spyOn(engine, 'update');

        const containerUrl = urlResolveDirectory(Faker.internet.url());
        const documentUrl = urlResolve(containerUrl, Faker.random.uuid());
        const url = `${documentUrl}#it`;
        const metadataUrl = `${documentUrl}#it-metadata`;
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
                        $where: { '@id': { $in: [metadataUrl, url] } },
                        $unset: true,
                    },
                },
            },
        );
    });

    it('deletes complex document structures properly', async () => {
        // Arrange - create models & urls
        const firstContainerUrl = urlResolveDirectory(Faker.internet.url());
        const secondContainerUrl = urlResolveDirectory(Faker.internet.url());
        const firstDocumentUrl = urlResolve(firstContainerUrl, Faker.random.uuid());
        const secondDocumentUrl = urlResolve(firstContainerUrl, Faker.random.uuid());
        const thirdDocumentUrl = urlResolve(secondContainerUrl, Faker.random.uuid());
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
            },
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
        class StubModel extends SolidModel {}

        bootModels({ StubModel });

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
            'https://example.org/bob': stubPersonJsonLD('https://example.org/bob', 'Bob'),
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

        const friends = john.friends as Person[];
        expect(friends[0]).toBeInstanceOf(Person);
        expect(friends[0].url).toBe('https://example.com/alice');
        expect(friends[0].name).toBe('Alice');
        expect(friends[1]).toBeInstanceOf(Person);
        expect(friends[1].url).toBe('https://example.org/bob');
        expect(friends[1].name).toBe('Bob');

        expect(engine.readMany).toHaveBeenCalledTimes(2);
        expect(engine.readMany).toHaveBeenCalledWith(
            'https://example.com/',
            {
                '$in': [
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
                '$in': [
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
        const movieUrl = urlResolve(Faker.internet.url());
        const watchActionUrl = `${movieUrl}#${Faker.random.uuid()}`;

        engine.setOne({
            '@graph': [
                ...stubMovieJsonLD(movieUrl, Faker.lorem.sentence())['@graph'],
                ...stubWatchActionJsonLD(watchActionUrl, movieUrl)['@graph'],
            ],
        } as EngineDocument);

        // Act
        const movie = await Movie.find(movieUrl) as Movie;

        // Assert
        expect(movie.actions).toHaveLength(1);

        const watchAction = movie.actions?.[0] as WatchAction;
        expect(watchAction).toBeInstanceOf(WatchAction);
        expect(watchAction.object).toBe(movieUrl);
        expect(watchAction.exists()).toBe(true);
    });

    it('implements is contained by relationship', async () => {
        // Arrange
        const name = Faker.random.word();
        const containerUrl = urlResolveDirectory(Faker.internet.url(), stringToSlug(name));
        const person = new Person({
            url: urlResolve(containerUrl, Faker.random.uuid()),
        });

        jest.spyOn(engine, 'readOne');
        jest.spyOn(engine, 'readMany');

        engine.setOne(stubGroupJsonLD(containerUrl, name));

        expect(person.group).toBeUndefined();

        // Act
        await person.loadRelation('group');

        // Assert
        expect(person.group).toBeInstanceOf(Group);

        const group = person.group as Group;
        expect(group.name).toBe(name);

        expect(engine.readOne).toHaveBeenCalledWith(urlParentDirectory(containerUrl), containerUrl);
    });

    it('serializes to JSON-LD', () => {
        // Arrange
        const containerUrl = urlResolveDirectory(Faker.internet.url());
        const name = Faker.random.word();
        const person = new Person({
            name,
            url: urlResolve(containerUrl, Faker.random.uuid()),
            friendUrls: [
                urlResolve(containerUrl, Faker.random.uuid()),
                urlResolve(containerUrl, Faker.random.uuid()),
                urlResolve(containerUrl, Faker.random.uuid()),
            ],
            createdAt: new Date('1997-07-21T23:42:00Z'),
        });

        // Act
        const jsonld = person.toJsonLD();

        // Assert
        const friendUrls = person.friendUrls as string[];
        expect(jsonld).toEqual({
            '@id': person.url,
            '@context': {
                '@vocab': 'http://xmlns.com/foaf/0.1/',
                'soukai': 'https://soukai.noeldemartin.com/vocab/',
                'metadata': { '@reverse': 'soukai:resource' },
            },
            '@type': 'Person',
            'name': name,
            'knows': friendUrls.map(url => ({ '@id': url })),
            'metadata': {
                '@id': person.url + '-metadata',
                '@type': 'soukai:Metadata',
                'soukai:createdAt': {
                    '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
                    '@value': '1997-07-21T23:42:00.000Z',
                },
            },
        });
    });

    it('serializes to JSON-LD with relations', () => {
        // Arrange
        const movieName = Faker.name.title();
        const movieUrl = urlResolve(Faker.internet.url(), stringToSlug(movieName));
        const watchActionUrl = `${movieUrl}#${Faker.random.uuid()}`;
        const movie = new Movie({ url: movieUrl, name: movieName });

        movie.setRelationModels('actions', [
            new WatchAction({
                url: watchActionUrl,
                object: movieUrl,
                startTime: new Date('1997-07-21T23:42:00Z'),
            }),
        ]);

        movie.actions?.forEach(action => action.setRelationModel('movie', movie));

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
        const containerUrl = urlResolveDirectory(Faker.internet.url());
        const name = Faker.random.word();
        const friendUrls = [
            urlResolve(containerUrl, Faker.random.uuid()),
            urlResolve(containerUrl, Faker.random.uuid()),
            urlResolve(containerUrl, Faker.random.uuid()),
        ];

        // Act
        const person = await Person.newFromJsonLD({
            '@context': { '@vocab': 'http://xmlns.com/foaf/0.1/' },
            '@id': urlResolve(containerUrl, Faker.random.uuid()),
            '@type': [
                'http://xmlns.com/foaf/0.1/Person',
            ],
            name,
            'knows': friendUrls.map(url => ({ '@id': url })),
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
        const containerUrl = urlResolveDirectory(Faker.internet.url());
        const name = Faker.random.word();
        const documentUrl = urlResolve(containerUrl, Faker.random.uuid());
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

        const action = movie.actions?.[0] as WatchAction;
        expect(action).toBeInstanceOf(WatchAction);
        expect(action.exists()).toBe(false);
        expect(action.url).toBeUndefined();
        expect(action.object).toBeUndefined();

        expect(movie.relatedActions.__modelsInSameDocument).toHaveLength(0);

        expect(movie.relatedActions.__newModels).toHaveLength(1);
        expect(movie.relatedActions.__newModels[0]).toBe(action);
    });

    it('Does not create operations on create', async () => {
        // Arrange
        class TrackedPerson extends Person {

            public static timestamps = true;
            public static history = true;

        }

        // Act
        const person = await TrackedPerson.create({ name: Faker.random.word() });

        // Assert
        expect(person.operations).toHaveLength(0);
    });

    it('Tracks operations with history enabled', async () => {
        // Arrange
        class PersonWithHistory extends Person {

            public static timestamps = true;
            public static history = true;

        }

        const firstName = Faker.random.word();
        const secondName = Faker.random.word();
        const firstLastName = Faker.random.word();
        const secondLastName = Faker.random.word();

        // Act
        const person = await PersonWithHistory.create({ name: firstName });

        await after({ ms: 100 });
        await person.update({ name: secondName, lastName: firstLastName });
        await after({ ms: 100 });
        await person.update({ lastName: secondLastName });

        // Assert
        const operations = person.operations as SolidModelOperation[];

        expect(operations).toHaveLength(4);

        operations.forEach(operation => expect(operation.url.startsWith(person.url)).toBe(true));
        operations.forEach(operation => expect(operation.resourceUrl).toEqual(person.url));

        expect(operations[0].property).toEqual(IRI('foaf:name'));
        expect(operations[0].value).toEqual(firstName);
        expect(operations[0].date).toEqual(person.createdAt);

        expect(operations[1].property).toEqual(IRI('foaf:name'));
        expect(operations[1].value).toEqual(secondName);
        expect(operations[1].date.getTime()).toBeGreaterThan(person.createdAt.getTime());
        expect(operations[1].date.getTime()).toBeLessThan(person.updatedAt.getTime());

        expect(operations[2].property).toEqual(IRI('foaf:lastName'));
        expect(operations[2].value).toEqual(firstLastName);
        expect(operations[2].date.getTime()).toBeGreaterThan(person.createdAt.getTime());
        expect(operations[2].date.getTime()).toBeLessThan(person.updatedAt.getTime());

        expect(operations[3].property).toEqual(IRI('foaf:lastName'));
        expect(operations[3].value).toEqual(secondLastName);
        expect(operations[3].date).toEqual(person.updatedAt);
    });

    it('[legacy] parses legacy automatic timestamps from JsonLD', async () => {
        // Arrange
        const date = new Date(Date.now() - 42000);
        const jsonld = {
            '@context': {
                '@vocab': 'http://xmlns.com/foaf/0.1/',
                'purl': 'http://purl.org/dc/terms/',
                'xls': 'http://www.w3.org/2001/XMLSchema#',
            },
            '@id': urlResolve(urlResolveDirectory(Faker.internet.url()), Faker.random.uuid()) + '#it',
            '@type': 'Person',
            'name': Faker.random.word(),
            'purl:created': {
                '@type': 'xls:dateTime',
                '@value': date.toISOString(),
            },
        };

        // Act
        const person = await Person.newFromJsonLD(jsonld);

        // Assert
        expect(person.createdAt).toBeInstanceOf(Date);
        expect(person.createdAt.toISOString()).toEqual(date.toISOString());
    });

});

describe('SolidModel types', () => {

    it('has correct types', async () => {
        // Arrange
        class StubModel extends SolidModel.schema({
            foo: FieldType.String,
            bar: FieldType.Number,
        }) {}

        setEngine(new StubEngine);

        // Act
        const instance = StubModel.newInstance();
        const jsonldInstance = await StubModel.newFromJsonLD({
            '@id': 'https://example.org/alice',
            'https://example.org/name': 'Alice',
        });

        // Assert
        tt<
            Expect<Equals<typeof instance, StubModel>> |
            Expect<Equals<typeof jsonldInstance, StubModel>> |
            Expect<Equals<typeof instance['foo'], string | undefined>> |
            Expect<Equals<typeof instance['bar'], number | undefined>> |
            true
        >();
    });

});
