import { InMemoryEngine, bootModels, setEngine } from 'soukai';
import { tap } from '@noeldemartin/utils';
import Faker from 'faker';
import type { EngineDocument } from 'soukai';

import Movie from '@/testing/lib/stubs/Movie';
import WatchAction from '@/testing/lib/stubs/WatchAction';

let engine: InMemoryEngine;

describe('CRUD', () => {

    beforeEach(() => {
        engine = new InMemoryEngine;

        setEngine(engine);
        bootModels({ Movie, WatchAction });
    });

    it('Creates models', async () => {
        // Arrange
        const name = Faker.name.title();

        // Act
        const movie = await Movie.create({ name });

        // Assert
        expect(movie.name).toBe(name);

        await expect(engine.database[Movie.collection][movie.requireDocumentUrl()]).toEqualJsonLD({
            '@graph': [
                {
                    '@context': 'https://schema.org/',
                    '@id': movie.url,
                    '@type': 'Movie',
                    name,
                },
            ],
        });
    });

    it('Reads models', async () => {
        // Arrange
        const name = Faker.name.title();
        const stub = createStub(name);

        // Act
        const movie = await Movie.find(stub.url) as Movie;

        // Assert
        expect(movie).not.toBeNull();
        expect(movie.name).toEqual(name);
    });

    it('Updates models', async () => {
        // Arrange
        const name = Faker.name.title();
        const stub = createStub(Faker.name.title());
        const movie = new Movie(stub.getAttributes(), true);

        // Act
        await movie.update({ name });

        // Assert
        expect(movie.name).toBe(name);

        await expect(engine.database[Movie.collection][stub.requireDocumentUrl()]).toEqualJsonLD({
            '@graph': [
                {
                    '@context': 'https://schema.org/',
                    '@id': stub.url,
                    '@type': 'Movie',
                    name,
                },
            ],
        });
    });

    it('Deletes models', async () => {
        // Arrange
        const stub = createStub();
        const movie = new Movie(stub.getAttributes(), true);

        // Act
        await movie.delete();

        // Assert
        expect(movie.exists()).toBe(false);
        expect(Object.values(engine.database[Movie.collection])).toHaveLength(0);
    });

});

function createStub(name?: string): Movie {
    return tap(new Movie({ name: name ?? Faker.name.title() }), stub => {
        stub.mintUrl();

        engine.database[Movie.collection] = {
            [stub.requireDocumentUrl()]: {
                '@graph': [stub.toJsonLD()],
            } as EngineDocument,
        };
    });
}
