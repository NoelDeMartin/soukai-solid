import Faker from 'faker';
import { InMemoryEngine, bootModels, setEngine } from 'soukai';
import { urlResolveDirectory } from '@noeldemartin/utils';

import MoviesCollection from '@/testing/lib/stubs/MoviesCollection';
import Movie from '@/testing/lib/stubs/Movie';
import StubEngine from '@/testing/lib/stubs/StubEngine';

describe('SolidContainsRelation', () => {

    beforeAll(() => bootModels({ MoviesCollection, Movie }));

    it('creates related models for solid engines', async () => {
        // Arrange
        setEngine(new StubEngine());

        const containerUrl = urlResolveDirectory(Faker.internet.url());
        const movieTitle = Faker.name.title();
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
    });

    it('creates related models for non-solid engines', async () => {
        // Arrange
        setEngine(new InMemoryEngine());

        const containerUrl = urlResolveDirectory(Faker.internet.url());
        const movieTitle = Faker.name.title();
        const collection = await MoviesCollection.create({ url: containerUrl });

        // Act
        const person = await collection.relatedMovies.create({ title: movieTitle });

        // Assert
        expect(collection.resourceUrls).toHaveLength(1);
        expect(collection.movies).toHaveLength(1);
        expect(collection.resourceUrls[0]).toEqual(person.getDocumentUrl());
        expect(collection.movies?.[0]).toEqual(person);
        expect(person.exists()).toBe(true);
        expect(person.url.startsWith(collection.url)).toBe(true);
        expect(person.title).toEqual(movieTitle);
    });

});
