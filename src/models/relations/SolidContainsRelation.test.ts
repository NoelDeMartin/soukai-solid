import { faker } from '@noeldemartin/faker';
import { fakeContainerUrl, fakeDocumentUrl } from '@noeldemartin/solid-utils';
import { InMemoryEngine, bootModels, setEngine } from 'soukai';

import MoviesCollection from '@/testing/lib/stubs/MoviesCollection';
import Movie from '@/testing/lib/stubs/Movie';
import StubEngine from '@/testing/lib/stubs/StubEngine';

describe('SolidContainsRelation', () => {

    beforeAll(() => bootModels({ MoviesCollection, Movie }));

    it('creates related models for solid engines', async () => {
        // Arrange
        setEngine(new StubEngine());

        const containerUrl = fakeContainerUrl();
        const movieTitle = faker.lorem.sentence();
        const collection = new MoviesCollection({ url: containerUrl }, true);

        collection.relatedMovies.related = [];

        // Act
        const movie = await collection.relatedMovies.create({ title: movieTitle });

        // Assert
        expect(collection.resourceUrls).toHaveLength(1);
        expect(collection.movies).toHaveLength(1);
        expect(collection.resourceUrls[0]).toEqual(movie.getDocumentUrl());
        expect(collection.movies?.[0]).toEqual(movie);
        expect(movie.exists()).toBe(true);
        expect(movie.url.startsWith(collection.url)).toBe(true);
        expect(movie.title).toEqual(movieTitle);
        expect(movie.collection).toBe(collection);
    });

    it('creates related models for non-solid engines', async () => {
        // Arrange
        setEngine(new InMemoryEngine());

        const movieTitle = faker.lorem.sentence();
        const collection = await MoviesCollection.create({ url: fakeContainerUrl({ baseUrl: fakeDocumentUrl() }) });

        // Act
        const movie = await collection.relatedMovies.create({ title: movieTitle });

        // Assert
        expect(collection.resourceUrls).toHaveLength(1);
        expect(collection.movies).toHaveLength(1);
        expect(collection.resourceUrls[0]).toEqual(movie.getDocumentUrl());
        expect(collection.movies?.[0]).toEqual(movie);
        expect(movie.exists()).toBe(true);
        expect(movie.url.startsWith(collection.url)).toBe(true);
        expect(movie.title).toEqual(movieTitle);
        expect(movie.collection).toBe(collection);
    });

});
