/* eslint-disable max-len */
import { after, arrayWithout, range, stringToSlug, tap, toString, tt, urlParentDirectory, urlResolve, urlResolveDirectory, urlRoute, uuid } from '@noeldemartin/utils';
import { expandIRI as defaultExpandIRI } from '@noeldemartin/solid-utils';
import { FieldType, InMemoryEngine, ModelKey, bootModels, setEngine } from 'soukai';
import dayjs from 'dayjs';
import { faker } from '@noeldemartin/faker';
import type { EngineDocument, Relation } from 'soukai';
import type { Constructor, Equals, Expect , Tuple } from '@noeldemartin/utils';
import type { JsonLDGraph, JsonLDResource } from '@noeldemartin/solid-utils';

import AddPropertyOperation from '@/models/history/AddPropertyOperation';
import DeleteOperation from '@/models/history/DeleteOperation';
import IRI from '@/solid/utils/IRI';
import PropertyOperation from '@/models/history/PropertyOperation';
import RemovePropertyOperation from '@/models/history/RemovePropertyOperation';
import SetPropertyOperation from '@/models/history/SetPropertyOperation';
import { defineSolidModelSchema } from '@/models/schema';
import type { SolidMagicAttributes, SolidModelConstructor } from '@/models/inference';

import Group from '@/testing/lib/stubs/Group';
import Movie from '@/testing/lib/stubs/Movie';
import MoviesCollection from '@/testing/lib/stubs/MoviesCollection';
import Person from '@/testing/lib/stubs/Person';
import StubEngine from '@/testing/lib/stubs/StubEngine';
import WatchAction from '@/testing/lib/stubs/WatchAction';
import { assertInstanceOf, fakeContainerUrl, fakeDocumentUrl, fakeResourceUrl } from '@/testing/utils';
import { stubMovieJsonLD, stubMoviesCollectionJsonLD, stubPersonJsonLD, stubWatchActionJsonLD } from '@/testing/lib/stubs/helpers';

import { SolidModel } from './SolidModel';

let engine: StubEngine;

describe('SolidModel', () => {

    beforeAll(() => bootModels({
        Group,
        GroupWithHistory,
        GroupWithHistoryAndPersonsInSameDocument,
        GroupWithPersonsInSameDocument,
        Movie,
        MoviesCollection,
        Person,
        PersonWithHistory,
        WatchAction,
    }));

    beforeEach(() => setEngine(engine = new StubEngine()));

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
                rdfPropertyAliases: [],
            },
        });
    });

    it('aliases RDF prefixes', () => {
        // Arrange
        class StubModel extends SolidModel {

            public static rdfContexts = {
                schema: 'https://schema.org/',
            };

            public static rdfsClasses = ['schema:Movie'];

            public static fields = {
                title: {
                    type: FieldType.String,
                    rdfProperty: 'schema:name',
                },
            };

        }

        bootModels({ StubModel });

        // Act
        StubModel.aliasRdfPrefixes({
            'https://schema.org/': 'http://schema.org/',
        });

        // Assert
        const fields = StubModel.instance().static('fields');

        expect(StubModel.rdfsClasses).toEqual(['https://schema.org/Movie']);
        expect(StubModel.rdfsClassesAliases).toEqual([['http://schema.org/Movie']]);
        expect(fields.title?.rdfProperty).toEqual('https://schema.org/name');
        expect(fields.title?.rdfPropertyAliases).toEqual(['http://schema.org/name']);
    });

    it('replaces RDF prefixes', () => {
        // Arrange
        class StubModel extends SolidModel {

            public static rdfContexts = {
                schema: 'https://schema.org/',
            };

            public static rdfsClasses = ['schema:Movie'];

            public static fields = {
                title: {
                    type: FieldType.String,
                    rdfProperty: 'schema:name',
                },
            };

        }

        bootModels({ StubModel });

        // Act
        StubModel.replaceRdfPrefixes({
            'https://schema.org/': 'http://schema.org/',
        });

        // Assert
        const fields = StubModel.instance().static('fields');

        expect(StubModel.rdfsClasses).toEqual(['http://schema.org/Movie']);
        expect(StubModel.rdfsClassesAliases).toEqual([]);
        expect(fields.title?.rdfProperty).toEqual('http://schema.org/name');
        expect(fields.title?.rdfPropertyAliases).toEqual([]);
    });

    it('resets RDF Aliases', () => {
        // Arrange
        class StubModel extends SolidModel {

            public static rdfContexts = {
                schema: 'https://schema.org/',
            };

            public static rdfsClasses = ['schema:Movie'];

            public static fields = {
                title: {
                    type: FieldType.String,
                    rdfProperty: 'schema:name',
                },
            };

        }

        bootModels({ StubModel });

        StubModel.aliasRdfPrefixes({
            'https://schema.org/': 'http://schema.org/',
        });

        // Act
        StubModel.resetRdfAliases();

        // Assert
        const fields = StubModel.instance().static('fields');

        expect(StubModel.rdfsClasses).toEqual(['https://schema.org/Movie']);
        expect(StubModel.rdfsClassesAliases).toEqual([]);
        expect(fields.title?.rdfProperty).toEqual('https://schema.org/name');
        expect(fields.title?.rdfPropertyAliases).toEqual([]);
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
                rdfPropertyAliases: [],
            },
        });
    });

    it('merges rdfs classes properly', () => {
        // Arrange.
        class A extends defineSolidModelSchema({ rdfsClass: 'A' }) { }
        class B extends defineSolidModelSchema(A, { rdfsClass: 'B' }) { }

        // Act
        bootModels({ A, B });

        // Assert
        expect(A.rdfsClasses).toEqual([A.rdfTerm('A')]);
        expect(B.rdfsClasses).toEqual([B.rdfTerm('B')]);
    });

    it('allows adding undefined fields', async () => {
        class StubModel extends SolidModel {}

        const containerUrl = urlResolveDirectory(faker.internet.url());
        const createSpy = jest.spyOn(engine, 'create');

        bootModels({ StubModel });

        await StubModel.at(containerUrl).create({ nickname: 'Johnny' });

        const document = createSpy.mock.calls[0]?.[1] as { '@graph': [{ nickname: string }] };

        expect(document['@graph'][0].nickname).toEqual('Johnny');
    });

    it('defines custom class fields', () => {
        // Arrange
        class StubModel extends SolidModel {

            public static classFields = ['stubField'];

        }

        bootModels({ StubModel });

        // Assert
        expect(StubModel.classFields).toHaveLength(6);
        expect(StubModel.classFields).toContain('_history');
        expect(StubModel.classFields).toContain('_engine');
        expect(StubModel.classFields).toContain('_sourceSubject');
        expect(StubModel.classFields).toContain('_publicPermissions');
        expect(StubModel.classFields).toContain('_tombstone');
        expect(StubModel.classFields).toContain('stubField');
    });

    it('sends types on create', async () => {
        class StubModel extends SolidModel {}

        const createSpy = jest.spyOn(engine, 'create');

        bootModels({ StubModel });

        await StubModel.create({});

        const document = createSpy.mock.calls[0]?.[1] as { '@graph': [{ '@type': string }] };

        expect(document['@graph'][0]['@type']).not.toBeUndefined();
    });

    it('removes duplicated array values', async () => {
        // Arrange
        const url = fakeResourceUrl();
        const name = faker.random.word();
        const movie = new Movie({ url, name, externalUrls: ['https://example.com', 'https://example.org', 'https://example.com'] });
        const createSpy = jest.spyOn(engine, 'create');

        // Act
        await movie.save();

        // Assert
        const document = createSpy.mock.calls[0]?.[1] as JsonLDGraph;

        expect(movie.externalUrls).toEqual(['https://example.com', 'https://example.org']);
        expect(document['@graph'][0]?.sameAs).toHaveLength(2);
    });

    it('uses latest operation date on save', async () => {
        // Arrange
        const person = await PersonWithHistory.create({ name: faker.random.word() });
        const updatedAt = new Date(Date.now() + 60000);

        await person.update({ name: faker.random.word() });
        await person.update({ name: faker.random.word() });
        await person.update({ name: faker.random.word() });
        await person.update({ name: faker.random.word() });
        await person.operations[1]?.update({ date: updatedAt });

        // Act
        person.updatedAt = updatedAt;

        await person.save();

        // Assert
        expect(person.updatedAt).toEqual(updatedAt);
        expect(person.operations).toHaveLength(5);
    });

    it('sends JSON-LD with related models in the same document', async () => {
        // Arrange
        const containerUrl = urlResolveDirectory(faker.internet.url());
        const movieName = faker.lorem.sentence();
        const directorName = faker.name.firstName();
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

        const document = createSpy.mock.calls[0]?.[1];
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

        const actions = movie.actions as Tuple<WatchAction, 1>;
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
        const containerUrl = urlResolveDirectory(faker.internet.url());
        const movieName = faker.lorem.sentence();
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
        expect(createSpy.mock.calls[0]?.[1]).toEqualJsonLD({
            '@graph': [
                ...stubMovieJsonLD(movieUrl, movieName)['@graph'],
                ...stubWatchActionJsonLD(action.url as string, movieUrl, '1997-07-21T23:42:00.000Z')['@graph'],
            ],
        });

        expect(movie.exists()).toBe(true);
        expect(movie.documentExists()).toBe(true);
        expect(movieUrl.startsWith(containerUrl)).toBe(true);

        const actions = movie.actions as Tuple<WatchAction, 1>;
        expect(actions[0].exists()).toBe(true);
        expect(actions[0].documentExists()).toBe(true);

        const url = actions[0].url as string;
        expect(url.startsWith(`${movie.getDocumentUrl()}#`)).toBe(true);
        expect(actions[0].object).toEqual(movie.url);
    });

    it('sends JSON-LD with related model updates using parent engine', async () => {
        // Arrange
        const containerUrl = urlResolveDirectory(faker.internet.url());
        const documentUrl = urlResolve(containerUrl, faker.datatype.uuid());
        const movieUrl = `${documentUrl}#it`;
        const actionUrl = `${documentUrl}#action`;
        const document = {
            '@graph': [
                ...stubMovieJsonLD(movieUrl, faker.lorem.sentence())['@graph'],
                ...stubWatchActionJsonLD(actionUrl, movieUrl)['@graph'],
            ],
        } as EngineDocument;
        const movie = await Movie.createFromEngineDocument(movieUrl, document, movieUrl);
        const action = movie.actions?.[0] as WatchAction;
        const updateSpy = jest.spyOn(engine, 'update');

        engine.setOne(document);
        action.setEngine(new InMemoryEngine);

        // Act
        movie.title = faker.lorem.sentence();
        action.startTime = new Date();

        await movie.save();

        // Assert
        expect(engine.update).toHaveBeenCalledWith(
            containerUrl,
            documentUrl,
            expect.anything(),
        );

        expect(updateSpy.mock.calls[0]?.[2]).toEqual({
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
                            $update: { [IRI('schema:name')]: movie.title },
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
        const people = await Person.from(peopleUrl).all({ name: 'Alice' }) as Tuple<Person, 1>;

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

        const containerUrl = urlResolveDirectory(faker.internet.url());
        const model = new StubModel(
            {
                url: urlResolve(containerUrl, faker.datatype.uuid()),
                surname: faker.name.lastName(),
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
        const containerUrl = urlResolveDirectory(faker.internet.url());
        const firstDocumentUrl = urlResolve(containerUrl, faker.datatype.uuid());
        const secondDocumentUrl = urlResolve(containerUrl, faker.datatype.uuid());
        const firstMovieUrl = `${firstDocumentUrl}#it`;
        const secondMovieUrl = `${secondDocumentUrl}#it`;
        const thirdMovieUrl = `${secondDocumentUrl}#${faker.datatype.uuid()}`;
        const firstWatchActionUrl = `${secondDocumentUrl}#${faker.datatype.uuid()}`;
        const secondWatchActionUrl = `${secondDocumentUrl}#${faker.datatype.uuid()}`;
        const firstMovieName = faker.lorem.sentence();
        const secondMovieName = faker.lorem.sentence();
        const thirdMovieName = faker.lorem.sentence();
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
        expect(firstMovie.title).toEqual(firstMovieName);
        expect(firstMovie.actions).toHaveLength(0);

        const secondMovie = movies.find(movie => movie.url === secondMovieUrl) as Movie;
        expect(secondMovie).not.toBeNull();
        expect(secondMovie.title).toEqual(secondMovieName);
        expect(secondMovie.actions).toHaveLength(1);

        const secondMovieActions = secondMovie.actions as Tuple<WatchAction, 1>;
        expect(secondMovieActions[0].url).toEqual(firstWatchActionUrl);
        expect(secondMovieActions[0].getSourceDocumentUrl()).toEqual(secondDocumentUrl);

        const thirdMovie = movies.find(movie => movie.url === thirdMovieUrl) as Movie;
        expect(thirdMovie).not.toBeNull();
        expect(thirdMovie.title).toEqual(thirdMovieName);
        expect(thirdMovie.actions).toHaveLength(1);

        const thirdMovieActions = thirdMovie.actions as Tuple<WatchAction, 1>;
        expect(thirdMovieActions[0].url).toEqual(secondWatchActionUrl);
        expect(thirdMovieActions[0].getSourceDocumentUrl()).toEqual(secondDocumentUrl);
    });

    it('mints url for new models', async () => {
        class StubModel extends SolidModel {}

        const containerUrl = urlResolveDirectory(faker.internet.url());

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

    it('uses default hash to mint urls for new models', async () => {
        // Arrange
        class StubModel extends SolidModel {

            public static defaultResourceHash = 'foobar';

        }

        const containerUrl = urlResolveDirectory(faker.internet.url());

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

        const containerUrl = urlResolveDirectory(faker.internet.url());

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

        const containerUrl = fakeContainerUrl();
        const escapedContainerUrl = containerUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const resourceUrl = fakeResourceUrl({ containerUrl });

        urlResolve(containerUrl, stringToSlug(faker.random.word()));

        engine.setOne({ url: resourceUrl });
        jest.spyOn(engine, 'create');

        bootModels({ StubModel });

        // Act
        const model = new StubModel({ url: resourceUrl });

        await model.save(containerUrl);

        // Assert
        expect(typeof model.url).toEqual('string');
        expect(model.url).not.toEqual(resourceUrl);
        expect(model.url).toMatch(new RegExp(`^${escapedContainerUrl}[\\d\\w-]+#it$`));
        expect(model.url.startsWith(containerUrl)).toBe(true);

        expect(engine.create).toHaveBeenCalledWith(
            containerUrl,
            expect.anything(),
            urlRoute(resourceUrl),
        );
        expect(engine.create).toHaveBeenCalledWith(
            containerUrl,
            expect.anything(),
            urlRoute(model.url),
        );
    });

    it('minted unique urls update relations', async () => {
        // Arrange
        const containerUrl = fakeContainerUrl();
        const escapedContainerUrl = containerUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const resourceUrl = fakeResourceUrl({ containerUrl });
        const createSpy = jest.spyOn(engine, 'create');

        engine.setOne({ url: resourceUrl });

        // Act
        const movie = new Movie({ url: resourceUrl });

        movie.relatedActions.create({});
        movie.relatedActors.create({});
        movie.relatedActors.create({});

        await movie.save();

        // Assert
        expect(movie.url).not.toEqual(resourceUrl);
        expect(movie.url).toMatch(new RegExp(`^${escapedContainerUrl}[\\d\\w-]+#it$`));
        expect(movie.url.startsWith(containerUrl)).toBe(true);

        const actions = movie.actions as Tuple<WatchAction, 1>;
        expect(actions).toHaveLength(1);
        expect(actions[0].object).toEqual(movie.url);

        const actors = movie.actors as Tuple<Person, 2>;
        expect(actors).toHaveLength(2);
        expect(actors[0].starred).toHaveLength(1);
        expect(actors[0].starred[0]).toEqual(movie.url);
        expect(actors[1].starred).toHaveLength(1);
        expect(actors[1].starred[0]).toEqual(movie.url);

        expect(engine.create).toHaveBeenCalledWith(
            containerUrl,
            expect.anything(),
            urlRoute(resourceUrl),
        );
        expect(engine.create).toHaveBeenCalledWith(
            containerUrl,
            expect.anything(),
            urlRoute(movie.url),
        );

        const graph = createSpy.mock.calls[1]?.[1] as JsonLDGraph;

        const actionJsonLD = graph['@graph'].find(resource => resource['@id'] === actions[0].url) as JsonLDResource;
        const actionMovieJsonLD = actionJsonLD['object'] as JsonLDResource;
        expect(actionMovieJsonLD['@id']).toEqual(movie.url);

        const firstActorJsonLD = graph['@graph'].find(resource => resource['@id'] === actors[0].url) as JsonLDResource;
        const firstActorMovieJsonLd = firstActorJsonLD['pastProject'] as JsonLDResource;
        expect(firstActorMovieJsonLd['@id']).toEqual(movie.url);

        const secondActorJsonLD = graph['@graph'].find(resource => resource['@id'] === actors[1].url) as JsonLDResource;
        const secondActorMovieJsonLd = secondActorJsonLD['pastProject'] as JsonLDResource;
        expect(secondActorMovieJsonLd['@id']).toEqual(movie.url);
    });

    it('uses explicit containerUrl for minting url on save', async () => {
        class StubModel extends SolidModel {}

        const containerUrl = urlResolveDirectory(faker.internet.url());

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
        const movieUrl = urlResolve(faker.internet.url(), faker.datatype.uuid());
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
                    $push: {
                        '@context': { '@vocab': 'https://schema.org/' },
                        '@id': action.url,
                        '@type': 'WatchAction',
                        'object': { '@id': movie.url },
                    },
                },
            },
        );
    });

    it('creates models in existing documents', async () => {
        // Arrange
        const documentUrl = urlResolve(faker.internet.url(), faker.datatype.uuid());
        const movieUrl = documentUrl + '#' + faker.datatype.uuid();
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
        const documentUrl = urlResolve(faker.internet.url(), faker.datatype.uuid());
        const movieName = faker.lorem.sentence();
        const movieUrl = documentUrl + '#' + faker.datatype.uuid();
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
                        $update: { [IRI('schema:name')]: movieName },
                    },
                },
            },
        );
    });

    it('uses model url container on find', async () => {
        class StubModel extends SolidModel {}

        const containerUrl = urlResolveDirectory(faker.internet.url());
        const readOneSpy = jest.spyOn(engine, 'readOne');

        bootModels({ StubModel });

        await StubModel.find(urlResolve(containerUrl, faker.datatype.uuid()));

        const collection = readOneSpy.mock.calls[0]?.[0];

        expect(collection).toEqual(containerUrl);
    });

    it('uses model url container on save', async () => {
        class StubModel extends SolidModel {}

        const containerUrl = urlResolveDirectory(faker.internet.url());
        const updateSpy = jest.spyOn(engine, 'update');

        bootModels({ StubModel });

        const model = new StubModel(
            { url: urlResolve(containerUrl, faker.datatype.uuid()) },
            true,
        );

        await model.update({ name: 'John' });

        const collection = updateSpy.mock.calls[0]?.[0];

        expect(collection).toEqual(containerUrl);
    });

    it('deletes the entire document if all stored resources are deleted', async () => {
        // Arrange
        const containerUrl = urlResolveDirectory(faker.internet.url());
        const documentUrl = urlResolve(containerUrl, faker.datatype.uuid());
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

        const containerUrl = urlResolveDirectory(faker.internet.url());
        const documentUrl = urlResolve(containerUrl, faker.datatype.uuid());
        const url = `${documentUrl}#it`;
        const model = new StubModel({ url, name: faker.name.firstName() }, true);

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
        const firstContainerUrl = urlResolveDirectory(faker.internet.url());
        const secondContainerUrl = urlResolveDirectory(faker.internet.url());
        const firstDocumentUrl = urlResolve(firstContainerUrl, faker.datatype.uuid());
        const secondDocumentUrl = urlResolve(firstContainerUrl, faker.datatype.uuid());
        const thirdDocumentUrl = urlResolve(secondContainerUrl, faker.datatype.uuid());
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

    it('soft deletes', async () => {
        // Arrange
        class TrackedPerson extends solidModelWithHistory(Person) { }

        const name = faker.random.word();
        const person = await TrackedPerson.create({ name });

        // Act
        await after({ ms: 10 });
        await person.softDelete();

        // Assert
        expect(person.isSoftDeleted()).toBe(true);
        expect(person.operations).toHaveLength(2);

        assertInstanceOf(person.operations[0], SetPropertyOperation, operation => {
            expect(operation.property).toEqual(IRI('foaf:name'));
            expect(operation.value).toEqual(name);
            expect(operation.date).toEqual(person.createdAt);
        });

        assertInstanceOf(person.operations[1], DeleteOperation, operation => {
            expect(person.createdAt).not.toEqual(person.updatedAt);
            expect(operation.date).toEqual(person.updatedAt);
            expect(operation.date).toEqual(person.deletedAt);
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

        const friends = john.friends as Tuple<Person, 2>;
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
        const movieUrl = urlResolve(faker.internet.url(), stringToSlug(faker.random.word()));
        const watchActionUrl = `${movieUrl}#${faker.datatype.uuid()}`;

        engine.setOne({
            '@graph': [
                ...stubMovieJsonLD(movieUrl, faker.lorem.sentence())['@graph'],
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
        const name = faker.random.word();
        const containerUrl = urlResolveDirectory(faker.internet.url(), stringToSlug(name));
        const movie = new Movie({
            url: urlResolve(containerUrl, faker.datatype.uuid()),
        });

        jest.spyOn(engine, 'readOne');
        jest.spyOn(engine, 'readMany');

        engine.setOne(stubMoviesCollectionJsonLD(containerUrl, name));

        expect(movie.collection).toBeUndefined();

        // Act
        await movie.loadRelation('collection');

        // Assert
        expect(movie.collection).toBeInstanceOf(MoviesCollection);

        const collection = movie.collection as MoviesCollection;
        expect(collection.name).toBe(name);

        expect(engine.readOne).toHaveBeenCalledWith(urlParentDirectory(containerUrl), containerUrl);
    });

    it('serializes to JSON-LD', () => {
        // Arrange
        const containerUrl = fakeContainerUrl();
        const name = faker.random.word();
        const person = new Person({
            name,
            url: urlResolve(containerUrl, faker.datatype.uuid()),
            friendUrls: [
                urlResolve(containerUrl, faker.datatype.uuid()),
                urlResolve(containerUrl, faker.datatype.uuid()),
                urlResolve(containerUrl, faker.datatype.uuid()),
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
                'crdt': 'https://vocab.noeldemartin.com/crdt/',
                'metadata': { '@reverse': 'crdt:resource' },
            },
            '@type': 'Person',
            'name': name,
            'knows': friendUrls.map(url => ({ '@id': url })),
            'metadata': {
                '@id': person.url + '-metadata',
                '@type': 'crdt:Metadata',
                'crdt:createdAt': {
                    '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
                    '@value': '1997-07-21T23:42:00.000Z',
                },
            },
        });
    });

    it('serializes to JSON-LD with relations', () => {
        // Arrange
        const movieName = faker.lorem.sentence();
        const movieUrl = urlResolve(faker.internet.url(), stringToSlug(movieName));
        const watchActionUrl = `${movieUrl}#${faker.datatype.uuid()}`;
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

    it('serializes to JSON-LD with nested relations', async () => {
        // Arrange
        const mugiwara = new GroupWithPersonsInSameDocument({ name: 'Straw Hat Pirates' });
        const luffy = mugiwara.relatedMembers.attach({ name: 'Luffy', lastName: 'Monkey D.' });
        const zoro = mugiwara.relatedMembers.attach({ name: 'Zoro', lastName: 'Roronoa' });

        await mugiwara.save();

        // Act
        const jsonLd = mugiwara.toJsonLD();

        // Assert
        expect(jsonLd).toEqual({
            '@context': {
                '@vocab': 'http://xmlns.com/foaf/0.1/',
                'crdt': 'https://vocab.noeldemartin.com/crdt/',
                'metadata': { '@reverse': 'crdt:resource' },
            },
            '@type': 'Group',
            '@id': mugiwara.url,
            'name': 'Straw Hat Pirates',
            'member': [
                {
                    '@id': luffy.url,
                    '@type': 'Person',
                    'name': 'Luffy',
                    'lastName': 'Monkey D.',
                    'metadata': {
                        '@id': `${luffy.url}-metadata`,
                        '@type': 'crdt:Metadata',
                        'crdt:createdAt': {
                            '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
                            '@value': luffy.createdAt.toISOString(),
                        },
                    },
                },
                {
                    '@id': zoro.url,
                    '@type': 'Person',
                    'name': 'Zoro',
                    'lastName': 'Roronoa',
                    'metadata': {
                        '@id': `${zoro.url}-metadata`,
                        '@type': 'crdt:Metadata',
                        'crdt:createdAt': {
                            '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
                            '@value': zoro.createdAt.toISOString(),
                        },
                    },
                },
            ],
            'metadata': {
                '@id': `${mugiwara.url}-metadata`,
                '@type': 'crdt:Metadata',
                'crdt:createdAt': {
                    '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
                    '@value': mugiwara.createdAt.toISOString(),
                },
                'crdt:updatedAt': {
                    '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
                    '@value': mugiwara.updatedAt.toISOString(),
                },
            },
        });
    });

    it('serializes to minimal JSON-LD', async () => {
        // Arrange
        const mugiwara = await GroupWithHistoryAndPersonsInSameDocument.create({ name: 'Straw Hat Pirates' });

        await mugiwara.relatedMembers.create({ name: 'Luffy', lastName: 'Monkey D.' });
        await mugiwara.relatedMembers.create({ name: 'Zoro', lastName: 'Roronoa' });
        await mugiwara.update({ name: 'Mugiwara' });

        // Act
        const jsonLd = mugiwara.toJsonLD({
            ids: false,
            timestamps: false,
            history: false,
        });

        // Assert
        expect(jsonLd).toEqual({
            '@context': { '@vocab': 'http://xmlns.com/foaf/0.1/' },
            '@type': 'Group',
            'name': 'Mugiwara',
            'member': [
                {
                    '@type': 'Person',
                    'name': 'Luffy',
                    'lastName': 'Monkey D.',
                },
                {
                    '@type': 'Person',
                    'name': 'Zoro',
                    'lastName': 'Roronoa',
                },
            ],
        });
    });

    it('parses JSON-LD', async () => {
        // Arrange
        const containerUrl = urlResolveDirectory(faker.internet.url());
        const name = faker.random.word();
        const friendUrls = [
            urlResolve(containerUrl, faker.datatype.uuid()),
            urlResolve(containerUrl, faker.datatype.uuid()),
            urlResolve(containerUrl, faker.datatype.uuid()),
        ];

        // Act
        const person = await Person.newFromJsonLD({
            '@context': { '@vocab': 'http://xmlns.com/foaf/0.1/' },
            '@id': urlResolve(containerUrl, faker.datatype.uuid()),
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
        const containerUrl = urlResolveDirectory(faker.internet.url());
        const movieName = faker.random.word();
        const directorName = faker.random.word();
        const groupName = faker.random.word();
        const creatorName = faker.random.word();
        const actions = range(2);
        const memberNames = [
            faker.random.word(),
            faker.random.word(),
        ];
        const documentUrl = urlResolve(containerUrl, faker.datatype.uuid());
        const movieUrl = `${documentUrl}#it`;
        const groupUrl = `${documentUrl}#it`;

        // Act - Create movie
        const movie = await Movie.newFromJsonLD({
            '@context': {
                '@vocab': 'https://schema.org/',
                'foaf': 'http://xmlns.com/foaf/0.1/',
                'director': { '@reverse': 'foaf:made' },
                'actions': { '@reverse': 'object' },
            },
            '@id': movieUrl,
            '@type': 'Movie',
            'name': movieName,
            'director': {
                '@id': `${documentUrl}#director`,
                '@type': 'foaf:Person',
                'foaf:name': directorName,
            },
            'actions': actions.map(index => ({
                '@id': `${documentUrl}#action-${index}`,
                '@type': 'WatchAction',
            })),
        });

        // Act - Create group
        const group = await Group.newFromJsonLD({
            '@context': {
                '@vocab': 'http://xmlns.com/foaf/0.1/',
            },
            '@id': groupUrl,
            '@type': 'Group',
            'name': groupName,
            'maker': {
                '@id': `${documentUrl}#creator`,
                '@type': 'Person',
                'name': creatorName,
            },
            'member': memberNames.map((memberName, index) => ({
                '@id': `${documentUrl}#member-${index}`,
                '@type': 'Person',
                'name': memberName,
            })),
        });

        // Assert - Movie & Group (parent models)
        expect(movie.exists()).toBe(false);
        expect(movie.title).toEqual(movieName);
        expect(movie.url).toBeUndefined();

        expect(group.exists()).toBe(false);
        expect(group.name).toEqual(groupName);
        expect(group.url).toBeUndefined();
        expect(group.creatorUrl).toBeUndefined();
        expect(group.memberUrls).toHaveLength(0);

        // Assert - Director (hasOne relation)
        const director = movie.director as Person;
        expect(director).toBeInstanceOf(Person);
        expect(director.exists()).toBe(false);
        expect(director.name).toEqual(directorName);
        expect(director.url).toBeUndefined();
        expect(director.directed).toBeUndefined();

        expect(movie.relatedDirector.__modelInSameDocument).toBeUndefined();
        expect(movie.relatedDirector.__modelInOtherDocumentId).toBeUndefined();
        expect(movie.relatedDirector.__newModel).toBe(director);

        // Assert - Actions (hasMany relation)
        expect(movie.actions).toHaveLength(actions.length);
        expect(movie.relatedActions.__newModels).toHaveLength(actions.length);

        actions.forEach(index => {
            const action = movie.actions?.[index] as WatchAction;

            expect(action).toBeInstanceOf(WatchAction);
            expect(action.exists()).toBe(false);
            expect(action.url).toBeUndefined();
            expect(action.object).toBeUndefined();

            expect(movie.relatedActions.__modelsInSameDocument).toHaveLength(0);
            expect(movie.relatedActions.__modelsInOtherDocumentIds).toHaveLength(0);
            expect(movie.relatedActions.__newModels[index]).toBe(action);
        });

        // Assert - Creator (belongsToOne relation)
        const creator = group.creator as Person;

        expect(creator).toBeInstanceOf(Person);
        expect(creator.exists()).toBe(false);
        expect(creator.name).toEqual(creatorName);
        expect(creator.url).toBeUndefined();

        expect(group.relatedCreator.__modelInSameDocument).toBeUndefined();
        expect(group.relatedCreator.__modelInOtherDocumentId).toBeUndefined();
        expect(group.relatedCreator.__newModel).toBe(creator);

        // Assert - Members (belongsToMany relation)
        expect(group.members).toHaveLength(memberNames.length);
        expect(group.relatedMembers.__newModels).toHaveLength(memberNames.length);

        memberNames.forEach((memberName, index) => {
            const member = group.members?.[index] as Person;

            expect(member).toBeInstanceOf(Person);
            expect(member.exists()).toBe(false);
            expect(member.url).toBeUndefined();
            expect(member.name).toEqual(memberName);

            expect(group.relatedMembers.__modelsInSameDocument).toHaveLength(0);
            expect(group.relatedMembers.__modelsInOtherDocumentIds).toHaveLength(0);
            expect(group.relatedMembers.__newModels[index]).toBe(member);
        });
    });

    it('imports from JSON-LD', async () => {
        // Arrange
        const name = faker.random.word();

        // Act
        const person = await Person.createFromJsonLD({
            '@context': { '@vocab': 'http://xmlns.com/foaf/0.1/' },
            '@id': 'john#it',
            '@type': 'Person',
            'name': name,
        });

        // Assert
        expect(person.url).toEqual(`${Person.collection}john#it`);
        expect(person.name).toEqual(name);
        expect(person.createdAt).toBeInstanceOf(Date);
    });

    it('imports from JSON-LD without an @id', async () => {
        // Arrange
        const name = faker.random.word();

        // Act
        const person = await Person.createFromJsonLD({
            '@context': { '@vocab': 'http://xmlns.com/foaf/0.1/' },
            '@type': 'Person',
            'name': name,
        });

        // Assert
        expect(person.url.startsWith(Person.collection)).toBe(true);
        expect(person.name).toEqual(name);
        expect(person.createdAt).toBeInstanceOf(Date);
    });

    it('fails importing from an invalid JSON-LD', async () => {
        const promisedPerson = Person.newFromJsonLD({
            '@context': { '@vocab': 'https://schema.org/' },
            '@type': 'Movie',
            '@id': fakeDocumentUrl(),
            'name': faker.random.word(),
        });

        await expect(promisedPerson).rejects.toThrowError('Couldn\'t find matching resource in JSON-LD');
    });

    it('Does not create operations on create', async () => {
        // Arrange
        class TrackedPerson extends Person {

            public static timestamps = true;
            public static history = true;

        }

        // Act
        const person = await TrackedPerson.create({ name: faker.random.word() });

        // Assert
        expect(person.operations).toHaveLength(0);
    });

    it('Tracks operations with history enabled', async () => {
        // Arrange
        const firstName = faker.random.word();
        const secondName = faker.random.word();
        const firstLastName = faker.random.word();
        const secondLastName = faker.random.word();

        // Act
        const person = await PersonWithHistory.create({ name: firstName });

        await after({ ms: 100 });
        await person.update({ name: secondName, lastName: firstLastName });
        await after({ ms: 100 });
        await person.update({ lastName: secondLastName });

        // Assert
        const operations = person.operations as Tuple<PropertyOperation, 4>;

        expect(operations).toHaveLength(4);

        operations.forEach(operation => expect(operation.url.startsWith(person.url)).toBe(true));
        operations.forEach(operation => expect(operation.resourceUrl).toEqual(person.url));

        assertInstanceOf(operations[0], SetPropertyOperation, operation => {
            expect(operation.property).toEqual(IRI('foaf:name'));
            expect(operation.value).toEqual(firstName);
            expect(operation.date).toEqual(person.createdAt);
        });

        assertInstanceOf(operations[1], SetPropertyOperation, operation => {
            expect(operation.property).toEqual(IRI('foaf:name'));
            expect(operation.value).toEqual(secondName);
            expect(operation.date.getTime()).toBeGreaterThan(person.createdAt.getTime());
            expect(operation.date.getTime()).toBeLessThan(person.updatedAt.getTime());
        });

        assertInstanceOf(operations[2], SetPropertyOperation, operation => {
            expect(operation.property).toEqual(IRI('foaf:lastName'));
            expect(operation.value).toEqual(firstLastName);
            expect(operation.date.getTime()).toBeGreaterThan(person.createdAt.getTime());
            expect(operation.date.getTime()).toBeLessThan(person.updatedAt.getTime());
        });

        assertInstanceOf(operations[3], SetPropertyOperation, operation => {
            expect(operation.property).toEqual(IRI('foaf:lastName'));
            expect(operation.value).toEqual(secondLastName);
            expect(operation.date).toEqual(person.updatedAt);
        });
    });

    it('Tracks history properly for array fields', async () => {
        // Arrange
        const firstName = faker.random.word();
        const secondName = faker.random.word();
        const initialMembers = [faker.random.word(), faker.random.word(), faker.random.word(), undefined];
        const firstAddedMembers = [faker.random.word(), faker.random.word()];
        const secondAddedMember = faker.random.word();
        const removedMembers = [initialMembers[1], firstAddedMembers[1]];

        // Act
        const group = await GroupWithHistory.create({
            name: firstName,
            memberUrls: initialMembers,
        });

        await after({ ms: 100 });
        await group.update({
            name: secondName,
            memberUrls: [
                ...group.memberUrls,
                ...firstAddedMembers,
            ],
        });

        await after({ ms: 100 });
        await group.update({
            memberUrls: arrayWithout(
                [
                    ...group.memberUrls,
                    secondAddedMember,
                ],
                removedMembers,
            ),
        });

        // Assert
        const operations = group.operations as Tuple<PropertyOperation, 6>;

        expect(operations).toHaveLength(6);

        operations.forEach(operation => expect(operation.url.startsWith(group.url)).toBe(true));
        operations.forEach(operation => expect(operation.resourceUrl).toEqual(group.url));

        assertInstanceOf(operations[0], SetPropertyOperation, operation => {
            expect(operation.property).toEqual(expandIRI('foaf:name'));
            expect(operation.value).toEqual(firstName);
            expect(operation.date).toEqual(group.createdAt);
        });

        assertInstanceOf(operations[1], SetPropertyOperation, operation => {
            expect(operation.property).toEqual(expandIRI('foaf:member'));
            expect(operation.value).toHaveLength(initialMembers.length - 1);
            initialMembers.forEach((memberUrl, index) => {
                if (memberUrl === undefined) {
                    expect(index in operation.value).toBeFalsy();

                    return;
                }

                expect(operation.value[index]).toBeInstanceOf(ModelKey);
                expect(toString(operation.value[index])).toEqual(memberUrl);
            });
            expect(operation.date).toEqual(group.createdAt);
        });

        assertInstanceOf(operations[2], SetPropertyOperation, operation => {
            expect(operation.property).toEqual(expandIRI('foaf:name'));
            expect(operation.value).toEqual(secondName);
            expect(operation.date.getTime()).toBeGreaterThan(group.createdAt.getTime());
            expect(operation.date.getTime()).toBeLessThan(group.updatedAt.getTime());
        });

        assertInstanceOf(operations[3], AddPropertyOperation, operation => {
            expect(operation.property).toEqual(expandIRI('foaf:member'));
            expect(operation.value).toHaveLength(firstAddedMembers.length);
            firstAddedMembers.forEach((memberUrl, index) => {
                expect(operation.value[index]).toBeInstanceOf(ModelKey);
                expect(toString(operation.value[index])).toEqual(memberUrl);
            });
            expect(operation.date.getTime()).toEqual(operation.date.getTime());
        });

        assertInstanceOf(operations[4], AddPropertyOperation, operation => {
            expect(operation.property).toEqual(expandIRI('foaf:member'));
            expect(operation.value).toBeInstanceOf(ModelKey);
            expect(toString(operation.value)).toEqual(secondAddedMember);
            expect(operation.date.getTime()).toEqual(group.updatedAt.getTime());
        });

        assertInstanceOf(operations[5], RemovePropertyOperation, operation => {
            expect(operation.property).toEqual(expandIRI('foaf:member'));
            expect(operation.value).toHaveLength(removedMembers.length);
            removedMembers.forEach((memberUrl, index) => {
                expect(operation.value[index]).toBeInstanceOf(ModelKey);
                expect(toString(operation.value[index])).toEqual(memberUrl);
            });
            expect(operation.date.getTime()).toEqual(group.updatedAt.getTime());
        });
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
            '@id': urlResolve(urlResolveDirectory(faker.internet.url()), faker.datatype.uuid()) + '#it',
            '@type': 'Person',
            'name': faker.random.word(),
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

    it('Tracks history properly for equivalent attributes', async () => {
        // Arrange
        const initialPersonUrl = fakeResourceUrl();
        const newPersonUrl = fakeResourceUrl();
        const person = new PersonWithHistory({
            url: fakeResourceUrl(),
            friendUrls: [new ModelKey(initialPersonUrl)],
        }, true);

        const updateSpy = jest.spyOn(engine, 'update');
        const readManySpy = jest.spyOn(engine, 'readMany');
        const readOneSpy = jest.spyOn(engine, 'readOne');

        // Act
        person.friendUrls = [initialPersonUrl, newPersonUrl];

        await person.save();

        // Assert
        const operations = person.operations as Tuple<PropertyOperation, 2>;

        expect(operations).toHaveLength(2);

        assertInstanceOf(operations[0], SetPropertyOperation, operation => {
            expect(operation.property).toEqual(IRI('foaf:knows'));
            expect(operation.value).toEqual(new ModelKey(initialPersonUrl));
        });

        assertInstanceOf(operations[1], AddPropertyOperation, operation => {
            expect(operation.property).toEqual(IRI('foaf:knows'));
            expect(operation.value).toEqual(new ModelKey(newPersonUrl));
        });

        expect(readOneSpy).not.toHaveBeenCalled();
        expect(readManySpy).not.toHaveBeenCalled();
        expect(updateSpy).toHaveBeenCalledTimes(1);
    });

    it('Rebuilds attributes from history', () => {
        // Arrange
        const name = faker.random.word();
        const lastName = faker.random.word();
        const initialFriends = [faker.internet.url(), faker.internet.url()];
        const firstAddedFriends = [faker.internet.url(), faker.internet.url()];
        const secondAddedFriend = faker.internet.url();
        const removedFriends = [initialFriends[1], firstAddedFriends[0]];
        const createdAt = faker.date.between(
            dayjs().subtract(3, 'months').toDate(),
            dayjs().subtract(1, 'month').toDate(),
        );
        const firstUpdatedAt = faker.date.between(
            dayjs().subtract(1, 'month').toDate(),
            dayjs().add(1, 'month').toDate(),
        );
        const deletedAt = faker.date.between(
            dayjs().add(1, 'month').toDate(),
            dayjs().add(3, 'months').toDate(),
        );
        const updatedAt = faker.date.between(
            dayjs().add(3, 'month').toDate(),
            dayjs().add(4, 'months').toDate(),
        );
        const person = new Person({
            name: faker.random.word(),
            lastName: faker.random.word(),
            givenName: faker.random.word(),
            friendUrls: [
                faker.internet.url(),
                faker.internet.url(),
            ],
        });

        // Arrange - initial operations
        person.relatedOperations.attachSetOperation({
            property: Person.getFieldRdfProperty('name'),
            value: faker.random.word(),
            date: createdAt,
        });

        person.relatedOperations.attachSetOperation({
            property: Person.getFieldRdfProperty('lastName'),
            value: lastName,
            date: createdAt,
        });

        person.relatedOperations.attachSetOperation({
            property: Person.getFieldRdfProperty('friendUrls'),
            value: initialFriends.map(url => new ModelKey(url)),
            date: createdAt,
        });

        // Arrange - second update operation (use wrong order on purpose to test sorting)
        person.relatedOperations.attachSetOperation({
            property: Person.getFieldRdfProperty('name'),
            value: name,
            date: updatedAt,
        });

        person.relatedOperations.attachAddOperation({
            property: Person.getFieldRdfProperty('friendUrls'),
            value: new ModelKey(secondAddedFriend),
            date: updatedAt,
        });

        person.relatedOperations.attachRemoveOperation({
            property: Person.getFieldRdfProperty('friendUrls'),
            value: removedFriends.map(url => new ModelKey(url)),
            date: updatedAt,
        });

        // Arrange - first update operation (use wrong order on purpose to test sorting)
        person.relatedOperations.attachSetOperation({
            property: Person.getFieldRdfProperty('name'),
            value: faker.random.word(),
            date: firstUpdatedAt,
        });

        person.relatedOperations.attachAddOperation({
            property: Person.getFieldRdfProperty('friendUrls'),
            value: firstAddedFriends.map(url => new ModelKey(url)),
            date: firstUpdatedAt,
        });

        // Arrange - soft delete
        person.relatedOperations.attachDeleteOperation({
            date: deletedAt,
        });

        // Act
        person.rebuildAttributesFromHistory();

        // Assert
        expect(person.isSoftDeleted()).toBe(true);
        expect(person.name).toEqual(name);
        expect(person.lastName).toEqual(lastName);
        expect(person.givenName).toBeUndefined();
        expect(person.friendUrls).toEqual(
            arrayWithout(
                [
                    ...initialFriends,
                    ...firstAddedFriends,
                    secondAddedFriend,
                ],
                removedFriends,
            ),
        );
        expect(person.createdAt).toEqual(createdAt);
        expect(person.deletedAt).toEqual(deletedAt);

        expect(person.getAttribute('updatedAt')).toEqual(updatedAt);
    });

    it('Synchronizes models history', async () => {
        // Arrange
        const inception = await PersonWithHistory.create({ name: 'Initial Name', lastName: 'Initial last name' });

        await inception.update({ name: 'Second name' });

        const versionA = inception.clone({ clean: true });
        const versionB = inception.clone({ clean: true });

        await versionA.update({ name: 'Name A' });
        await after({ ms: 100 });
        await versionB.update({ lastName: 'Last name B' });

        // Act
        await SolidModel.synchronize(versionA, versionB);

        // Assert
        expect(versionA.getAttributes()).toEqual(versionB.getAttributes());
        expect(versionA.getHistoryHash()).not.toBeNull();
        expect(versionA.getHistoryHash()).toEqual(versionB.getHistoryHash());

        expect(versionA.isDirty('name')).toBe(false);
        expect(versionA.isDirty('lastName')).toBe(true);
        expect(versionB.isDirty('name')).toBe(true);
        expect(versionB.isDirty('lastName')).toBe(false);

        expect(versionA.operations).toHaveLength(5);
        expect(versionB.operations).toHaveLength(5);

        expect(versionA.updatedAt).toEqual(versionA.operations[4]?.date);
        expect(versionB.updatedAt).toEqual(versionB.operations[4]?.date);

        expect(versionA.operations[0]?.exists()).toBe(true);
        expect(versionA.operations[1]?.exists()).toBe(true);
        expect(versionA.operations[2]?.exists()).toBe(true);
        expect(versionA.operations[3]?.exists()).toBe(true);
        expect(versionA.operations[4]?.exists()).toBe(false);
        assertInstanceOf(versionA.operations[4], SetPropertyOperation, operation => {
            expect(operation.property).toBe(IRI('foaf:lastName'));
            expect(operation.value).toBe('Last name B');
        });

        expect(versionB.operations[0]?.exists()).toBe(true);
        expect(versionB.operations[1]?.exists()).toBe(true);
        expect(versionB.operations[2]?.exists()).toBe(true);
        expect(versionB.operations[3]?.exists()).toBe(false);
        assertInstanceOf(versionB.operations[3], SetPropertyOperation, operation => {
            expect(operation.property).toBe(IRI('foaf:name'));
            expect(operation.value).toBe('Name A');
        });
        expect(versionB.operations[4]?.exists()).toBe(true);

        range(5).forEach(index => {
            const operationA = versionA.operations[index] as SetPropertyOperation;
            const operationB = versionB.operations[index] as SetPropertyOperation;
            expect(operationA).toBeInstanceOf(SetPropertyOperation);
            expect(operationB).toBeInstanceOf(SetPropertyOperation);
            expect(operationA.url).toEqual(operationB.url);
            expect(operationA.property).toEqual(operationB.property);
            expect(operationA.value).toEqual(operationB.value);
            expect(operationA.date).toEqual(operationB.date);
        });
    });

    it('Does not recreate operations for synchronized changes', async () => {
        // Arrange
        const inception = await PersonWithHistory.create({ name: 'Initial Name', lastName: 'Initial last name' });

        await inception.update({ name: 'Second name' });

        const versionA = inception.clone({ clean: true });
        const versionB = inception.clone({ clean: true });

        await versionA.update({ name: 'Name A' });
        await after({ ms: 100 });
        await versionB.update({ lastName: 'Last name B' });
        await SolidModel.synchronize(versionA, versionB);
        await after({ ms: 100 });

        const updateSpy = jest.spyOn(engine, 'update');

        // Act
        await versionA.save();
        await versionB.save();

        // Assert
        [versionA, versionB].forEach(model => {
            expect(model.isDirty()).toBe(false);
            expect(model.updatedAt).toEqual(model.operations[4]?.date);
            expect(model.operations).toHaveLength(5);

            model.operations.forEach(operation => expect(operation.exists()).toBe(true));
        });

        expect(updateSpy).toHaveBeenCalledTimes(2);
        expect(updateSpy.mock.calls[0]?.[2]).toEqual({
            '@graph': {
                $apply: [
                    {
                        $updateItems: {
                            $where: { '@id': versionA.metadata.url },
                            $update: {
                                [IRI('crdt:updatedAt')]: {
                                    '@value': versionA.updatedAt.toISOString(),
                                    '@type': IRI('xsd:dateTime'),
                                },
                            },
                        },
                    },
                    { $push: versionA.operations[4]?.toJsonLD() },
                    {
                        $updateItems: {
                            $where: { '@id': versionA.url },
                            $update: { [IRI('foaf:lastName')]: 'Last name B' },
                        },
                    },
                ],
            },
        });
        expect(updateSpy.mock.calls[1]?.[2]).toEqual({
            '@graph': {
                $apply: [
                    { $push: versionB.operations[3]?.toJsonLD() },
                    {
                        $updateItems: {
                            $where: { '@id': versionB.url },
                            $update: { [IRI('foaf:name')]: 'Name A' },
                        },
                    },
                ],
            },
        });
    });

    it('Avoids duplicating inception operations when synchronizing models', async () => {
        // Arrange
        const inception = await PersonWithHistory.create({ name: 'Initial Name', lastName: 'Initial last name' });
        const versionA = inception.clone({ clean: true });
        const versionB = inception.clone({ clean: true });

        await versionA.update({ name: 'Name A' });
        await after({ ms: 100 });
        await versionB.update({ lastName: 'Last name B' });

        // Act
        await SolidModel.synchronize(versionA, versionB);

        // Assert
        expect(versionA.getAttributes()).toEqual(versionB.getAttributes());
        expect(versionA.getHistoryHash()).not.toBeNull();
        expect(versionA.getHistoryHash()).toEqual(versionB.getHistoryHash());

        expect(versionA.isDirty('name')).toBe(false);
        expect(versionA.isDirty('lastName')).toBe(true);
        expect(versionB.isDirty('name')).toBe(true);
        expect(versionB.isDirty('lastName')).toBe(false);

        expect(versionA.operations).toHaveLength(4);
        expect(versionB.operations).toHaveLength(4);

        expect(versionA.updatedAt).toEqual(versionA.operations[3]?.date);
        expect(versionB.updatedAt).toEqual(versionB.operations[3]?.date);

        expect(versionA.operations[0]?.exists()).not.toBe(versionB.operations[0]?.exists());
        expect(versionA.operations[1]?.exists()).not.toBe(versionB.operations[1]?.exists());

        expect(versionA.operations[2]?.exists()).toBe(true);
        expect(versionA.operations[3]?.exists()).toBe(false);
        assertInstanceOf(versionA.operations[3], SetPropertyOperation, operation => {
            expect(operation.property).toBe(IRI('foaf:lastName'));
            expect(operation.value).toBe('Last name B');
        });

        expect(versionB.operations[2]?.exists()).toBe(false);
        assertInstanceOf(versionB.operations[2], SetPropertyOperation, operation => {
            expect(operation.property).toBe(IRI('foaf:name'));
            expect(operation.value).toBe('Name A');
        });
        expect(versionB.operations[3]?.exists()).toBe(true);

        range(4).forEach(index => {
            const operationA = versionA.operations[index] as SetPropertyOperation;
            const operationB = versionB.operations[index] as SetPropertyOperation;
            expect(operationA).toBeInstanceOf(SetPropertyOperation);
            expect(operationB).toBeInstanceOf(SetPropertyOperation);
            expect(operationA.url).toEqual(operationB.url);
            expect(operationA.property).toEqual(operationB.property);
            expect(operationA.value).toEqual(operationB.value);
            expect(operationA.date).toEqual(operationB.date);
        });
    });

    it('Reconciles synchronized operations on save', async () => {
        // Arrange
        const inception = await PersonWithHistory.create({ name: 'Initial Name', lastName: 'Initial last name' });
        const versionA = inception.clone({ clean: true });
        const versionB = inception.clone({ clean: true });

        await after({ ms: 100 });
        await versionA.update({ name: 'Name A' });
        await after({ ms: 100 });
        await versionB.update({ lastName: 'Last name B' });

        const originalInceptionOperationUrls = new WeakMap<PersonWithHistory, Record<string, string>>();

        [versionA, versionB].forEach(model => originalInceptionOperationUrls.set(
            model,
            model.operations
                .filter((operation): operation is PropertyOperation => operation.date.getTime() === model.createdAt.getTime())
                .reduce((map, operation) => ({ ...map, [operation.property]: operation.url }), {}),
        ));

        await SolidModel.synchronize(versionA, versionB);

        const reconciliatedOperationModels = [IRI('foaf:name'), IRI('foaf:lastName')].reduce((map, property) => {
            map[property] = versionA.operations.find(operation => operation instanceof PropertyOperation && operation.property === property)?.exists()
                ? versionB
                : versionA;

            return map;
        }, {} as Record<string, PersonWithHistory>);
        const updateSpy = jest.spyOn(engine, 'update');

        // Act
        await versionA.save();
        await versionB.save();

        // Assert
        [versionA, versionB].forEach(model => {
            expect(model.isDirty()).toBe(false);
            expect(model.updatedAt).toEqual(model.operations[3]?.date);
            expect(model.operations).toHaveLength(4);

            model.operations.forEach(operation => expect(operation.exists()).toBe(true));
        });

        const getNewInceptionUpdates = (model: PersonWithHistory) => {
            type Update = { $push: JsonLDResource };

            return tap(
                Object.entries(reconciliatedOperationModels).reduce((updated, [property, reconciliatedModel]) => {
                    if (reconciliatedModel === model)
                        updated.push({
                            $push: model
                                .operations
                                .find(operation => operation instanceof PropertyOperation && operation.property === property)
                                ?.toJsonLD(),
                        } as Update);

                    return updated;
                }, [] as Update[]),
                updates => updates.sort((a, b) => a.$push['@id'] > b.$push['@id'] ? 1 : -1),
            );
        };
        const getDeletedInceptionUpdates = (model: PersonWithHistory) => {
            type Update = {
                $updateItems: {
                    $where: { '@id': string};
                    $unset: true;
                };
            };

            return tap(
                Object.entries(reconciliatedOperationModels).reduce((updated, [property, reconciliatedModel]) => {
                    if (reconciliatedModel === model)
                        updated.push({
                            $updateItems: {
                                $where: { '@id': originalInceptionOperationUrls.get(model)?.[property] },
                                $unset: true,
                            },
                        } as Update);

                    return updated;
                }, [] as Update[])
                , updates => updates.sort((a, b) => a.$updateItems.$where['@id'] > b.$updateItems.$where['@id'] ? 1 : -1),
            );
        };

        expect(updateSpy).toHaveBeenCalledTimes(2);

        const updatesA = updateSpy.mock.calls[0]?.[2];
        const updatesB = updateSpy.mock.calls[1]?.[2];

        expect(updatesA).toEqual({
            '@graph': {
                $apply: [
                    {
                        $updateItems: {
                            $where: { '@id': versionA.metadata.url },
                            $update: {
                                [IRI('crdt:updatedAt')]: {
                                    '@value': versionA.updatedAt.toISOString(),
                                    '@type': IRI('xsd:dateTime'),
                                },
                            },
                        },
                    },
                    ...getNewInceptionUpdates(versionA),
                    { $push: versionA.operations[3]?.toJsonLD() },
                    {
                        $updateItems: {
                            $where: { '@id': versionA.url },
                            $update: { [IRI('foaf:lastName')]: 'Last name B' },
                        },
                    },
                    ...getDeletedInceptionUpdates(versionA),
                ],
            },
        });

        expect(updatesB).toEqual({
            '@graph': {
                $apply: [
                    ...getNewInceptionUpdates(versionB),
                    { $push: versionB.operations[2]?.toJsonLD() },
                    {
                        $updateItems: {
                            $where: { '@id': versionB.url },
                            $update: { [IRI('foaf:name')]: 'Name A' },
                        },
                    },
                    ...getDeletedInceptionUpdates(versionB),
                ],
            },
        });
    });

    it('Synchronizes models history with relations', async () => {
        // Arrange
        const group = await GroupWithHistoryAndPersonsInSameDocument.create({ name: 'Group' });

        const versionA = group.clone({ clean: true });
        const versionB = group.clone({ clean: true });

        await after({ ms: 100 });
        await versionA.relatedMembers.create({ name: 'John' });
        await after({ ms: 100 });
        await versionB.relatedMembers.create({ name: 'Amy' });

        // Act
        await SolidModel.synchronize(versionA, versionB);

        // Assert
        [versionA, versionB].forEach(model => {
            expect(model.memberUrls).toHaveLength(2);
            expect(model.members).toHaveLength(2);
            expect(model.members?.[0]?.name).toEqual('John');
            expect(model.members?.[1]?.name).toEqual('Amy');
        });

        expect(versionA.members?.[0]?.exists()).toBe(true);
        expect(versionA.members?.[1]?.exists()).toBe(false);

        expect(versionB.members?.[0]?.exists()).toBe(false);
        expect(versionB.members?.[1]?.exists()).toBe(true);
    });

    it('History tracking for new arrays uses add operation', async () => {
        // Arrange
        setEngine(new InMemoryEngine);

        const { url } = await PersonWithHistory.create();
        const person = await PersonWithHistory.findOrFail(url);
        const friendUrls = range(3).map(() => fakeResourceUrl({ hash: uuid() }));

        // Act
        await person.update({ friendUrls });

        // Assert
        expect(person.operations).toHaveLength(1);

        const operation = person.operations[0] as AddPropertyOperation;
        expect(operation).toBeInstanceOf(AddPropertyOperation);
        expect(operation.resourceUrl).toEqual(person.url);
        expect(operation.property).toEqual(IRI('foaf:knows'));
        expect(operation.value).toHaveLength(friendUrls.length);

        (operation.value as ModelKey[]).forEach((url, index) => {
            expect(url).toBeInstanceOf(ModelKey);
            expect(new ModelKey(friendUrls[index]).equals(url));
        });
    });

    it('casts nulls, undefined and empty arrays', () => {
        const person = new Person({
            name: null,
            friendUrls: null,
        });

        expect(person.name).toBeUndefined();
        expect(person.lastName).toBeUndefined();
        expect(person.friendUrls).toEqual([]);

        person.unsetAttribute('friendUrls');
        expect(person.friendUrls).toEqual([]);
    });

});

describe('SolidModel types', () => {

    it('has correct types', async () => {
        // Arrange
        class StubModel extends defineSolidModelSchema({
            fields: {
                foo: FieldType.String,
                bar: FieldType.Number,
                baz: {
                    type: FieldType.Array,
                    items: FieldType.Date,
                },
            },
        }) {}

        setEngine(new StubEngine);

        // Act
        const instance = StubModel.newInstance();
        const jsonldInstance = await StubModel.newFromJsonLD({
            '@context': { '@vocab': 'http://www.w3.org/ns/solid/terms#' },
            '@id': 'https://example.org/alice',
            '@type': 'StubModel',
            'https://example.org/name': 'Alice',
        });

        // Assert
        tt<
            Expect<Equals<typeof instance, StubModel>> |
            Expect<Equals<typeof jsonldInstance, StubModel>> |
            Expect<Equals<typeof instance['foo'], string | undefined>> |
            Expect<Equals<typeof instance['bar'], number | undefined>> |
            Expect<Equals<typeof instance['baz'], Date[]>> |
            true
        >();
    });

});

function expandIRI(iri: string) {
    return defaultExpandIRI(iri, {
        extraContext: {
            crdt: 'https://vocab.noeldemartin.com/crdt/',
            foaf: 'http://xmlns.com/foaf/0.1/',
        },
    });
}

function solidModelWithTimestamps<T extends SolidModel>(model: SolidModelConstructor<T>): Constructor<SolidMagicAttributes<{ timestamps: true }>> & SolidModelConstructor<T> {
    return defineSolidModelSchema(model, { timestamps: true });
}

function solidModelWithHistory<T extends SolidModel>(model: SolidModelConstructor<T>): Constructor<SolidMagicAttributes<{ timestamps: true; history: true }>> & SolidModelConstructor<T> {
    return defineSolidModelSchema(model, { timestamps: true, history: true });
}

class PersonWithHistory extends solidModelWithHistory(Person) {}

class GroupWithHistory extends solidModelWithHistory(Group) {}

class GroupWithPersonsInSameDocument extends solidModelWithTimestamps(Group) {

    public membersRelationship(): Relation {
        return this
            .belongsToMany(Person, 'memberUrls')
            .usingSameDocument(true)
            .onDelete('cascade');
    }

}

class GroupWithHistoryAndPersonsInSameDocument extends solidModelWithHistory(Group) {

    public membersRelationship(): Relation {
        return this
            .belongsToMany(Person, 'memberUrls')
            .usingSameDocument(true)
            .onDelete('cascade');
    }

}
