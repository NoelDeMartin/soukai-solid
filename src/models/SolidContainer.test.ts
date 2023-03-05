import { faker } from '@noeldemartin/faker';
import { FieldType, bootModels, setEngine } from 'soukai';
import { stringToSlug, urlResolve, urlResolveDirectory } from '@noeldemartin/utils';
import type { EngineDocument } from 'soukai';
import type { Tuple } from '@noeldemartin/utils';

import IRI from '@/solid/utils/IRI';

import { stubMovieJsonLD, stubMoviesCollectionJsonLD, stubSolidDocumentJsonLD } from '@/testing/lib/stubs/helpers';
import Movie from '@/testing/lib/stubs/Movie';
import WatchAction from '@/testing/lib/stubs/WatchAction';
import MoviesCollection from '@/testing/lib/stubs/MoviesCollection';
import StubEngine from '@/testing/lib/stubs/StubEngine';

import SolidContainer from './SolidContainer';
import SolidDocument from './SolidDocument';

let engine: StubEngine;

describe('SolidContainer', () => {

    beforeAll(() => bootModels({ Movie, MoviesCollection, WatchAction }));
    beforeEach(() => setEngine(engine = new StubEngine()));

    it('adds ldp:Container rdfsClass', () => {
        class StubModel extends SolidContainer {}

        bootModels({ StubModel });

        expect(StubModel.rdfsClasses).toEqual([IRI('ldp:Container')]);
    });

    it('adds resourceUrls field', () => {
        // Arrange
        class StubModel extends SolidContainer {

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
                rdfPropertyAliases: [],
            },
            description: {
                type: FieldType.String,
                required: false,
                rdfProperty: IRI('rdfs:comment'),
                rdfPropertyAliases: [],
            },
            resourceUrls: {
                type: FieldType.Array,
                required: false,
                rdfProperty: IRI('ldp:contains'),
                rdfPropertyAliases: [],
                items: {
                    type: FieldType.Key,
                },
            },
            createdAt: {
                type: FieldType.Date,
                required: false,
                rdfProperty: IRI('purl:created'),
                rdfPropertyAliases: [],
            },
            updatedAt: {
                type: FieldType.Date,
                required: false,
                rdfProperty: IRI('purl:modified'),
                rdfPropertyAliases: [],
            },
        });
    });

    it('adds documents relation', async () => {
        // Arrange
        const containerUrl = urlResolveDirectory(faker.internet.url());
        const firstDocumentUrl = urlResolve(containerUrl, faker.datatype.uuid());
        const secondDocumentUrl = urlResolve(containerUrl, faker.datatype.uuid());

        engine.setOne({
            '@graph': [
                stubMoviesCollectionJsonLD(
                    containerUrl,
                    faker.lorem.word(),
                    [firstDocumentUrl, secondDocumentUrl],
                )['@graph'][0],
                stubSolidDocumentJsonLD(firstDocumentUrl, '1997-07-21T23:42:00.000Z')['@graph'][0],
                stubSolidDocumentJsonLD(secondDocumentUrl, '2010-02-15T23:42:00.000Z')['@graph'][0],
            ],
        } as EngineDocument);

        // Act
        const collection = await MoviesCollection.find(containerUrl) as MoviesCollection;

        // Assert
        const documents = collection.documents as Tuple<SolidDocument, 2>;

        expect(collection.documents).toHaveLength(2);

        expect(documents[0].url).toEqual(firstDocumentUrl);
        expect(documents[0].updatedAt).toEqual(new Date('1997-07-21T23:42:00.000Z'));

        expect(documents[1].url).toEqual(secondDocumentUrl);
        expect(documents[1].updatedAt).toEqual(new Date('2010-02-15T23:42:00.000Z'));
    });

    it('implements contains relationship', async () => {
        // Arrange
        const containerUrl = urlResolveDirectory(faker.internet.url());
        const theLordOfTheRingsUrl = urlResolve(containerUrl, 'the-lord-of-the-rings');
        const spiritedAwayUrl = urlResolve(containerUrl, 'spirited-away');
        const collection = new MoviesCollection({
            url: containerUrl,
            resourceUrls: [
                theLordOfTheRingsUrl,
                spiritedAwayUrl,
            ],
        });

        collection.setRelationModels('documents', [
            new SolidDocument({ url: theLordOfTheRingsUrl }),
            new SolidDocument({ url: spiritedAwayUrl }),
        ]);

        jest.spyOn(engine, 'readMany');

        engine.setMany(containerUrl, {
            [theLordOfTheRingsUrl]: stubMovieJsonLD(theLordOfTheRingsUrl, 'The Lord Of The Rings'),
            [spiritedAwayUrl]: stubMovieJsonLD(spiritedAwayUrl, 'Spirited Away'),
        });

        expect(collection.movies).toBeUndefined();

        // Act
        await collection.loadRelation('movies');

        // Assert
        const collectionMovies = collection.movies as Tuple<Movie, 2>;
        expect(collectionMovies).toHaveLength(2);
        expect(collectionMovies[0]).toBeInstanceOf(Movie);
        expect(collectionMovies[0].url).toBe(theLordOfTheRingsUrl);
        expect(collectionMovies[0].title).toBe('The Lord Of The Rings');
        expect(collectionMovies[1]).toBeInstanceOf(Movie);
        expect(collectionMovies[1].url).toBe(spiritedAwayUrl);
        expect(collectionMovies[1].title).toBe('Spirited Away');

        expect(engine.readMany).toHaveBeenCalledTimes(1);
        expect(engine.readMany).toHaveBeenCalledWith(
            containerUrl,
            {
                '$in': [
                    theLordOfTheRingsUrl,
                    spiritedAwayUrl,
                ],
                '@graph': {
                    $contains: {
                        '@type': {
                            $or: [
                                { $contains: ['Movie'] },
                                { $contains: [IRI('schema:Movie')] },
                                { $eq: 'Movie' },
                                { $eq: IRI('schema:Movie') },
                            ],
                        },
                    },
                },
            },
        );
    });

    it('uses name for minting url for new containers', async () => {
        // Arrange
        class StubModel extends SolidContainer {

            public static rdfContexts = {
                foaf: 'http://xmlns.com/foaf/0.1/',
            };

        }

        const containerUrl = urlResolveDirectory(faker.internet.url());
        const name = faker.random.word();

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
        class StubModel extends SolidContainer {

            public static rdfContexts = {
                foaf: 'http://xmlns.com/foaf/0.1/',
            };

        }

        const name = faker.random.word();
        const slug = stringToSlug(name);
        const containerUrl = urlResolveDirectory(faker.internet.url());
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
        const collection = await MoviesCollection.create({ name: faker.random.word() }) as MoviesCollection;

        expect(collection.isRelationLoaded('documents')).toBe(true);
        expect(collection.documents).toEqual([]);
    });

});
