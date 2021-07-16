import { InMemoryEngine, bootModels, setEngine } from 'soukai';
import { tap } from '@noeldemartin/utils';
import Faker from 'faker';
import type { EngineDocument } from 'soukai';

import Movie from '@/testing/lib/stubs/Movie';
import WatchAction from '@/testing/lib/stubs/WatchAction';

let engine: InMemoryEngine;

describe('Soukai CRUD', () => {

    beforeEach(() => {
        engine = new InMemoryEngine;

        setEngine(engine);
        bootModels({ Movie, WatchAction });
    });

    it('Creates models', async () => {
        // Arrange
        const title = Faker.name.title();

        // Act
        const movie = await Movie.create({ title });

        // Assert
        expect(movie.title).toBe(title);

        await expect(engine.database[Movie.collection][movie.requireDocumentUrl()]).toEqualJsonLD({
            '@graph': [
                {
                    '@context': { '@vocab': 'https://schema.org/' },
                    '@id': movie.url,
                    '@type': 'Movie',
                    'name': title,
                },
            ],
        });
    });

    it('Reads models', async () => {
        // Arrange
        const title = Faker.name.title();
        const stub = createStub(title);

        // Act
        const movie = await Movie.find(stub.url) as Movie;

        // Assert
        expect(movie).not.toBeNull();
        expect(movie.title).toEqual(title);
    });

    it('Updates models', async () => {
        // Arrange
        const title = Faker.name.title();
        const stub = createStub(Faker.name.title());
        const movie = new Movie(stub.getAttributes(), true);

        // Act
        await movie.update({ title });

        // Assert
        expect(movie.title).toBe(title);

        await expect(engine.database[Movie.collection][stub.requireDocumentUrl()]).toEqualJsonLD({
            '@graph': [
                {
                    '@context': { '@vocab': 'https://schema.org/' },
                    '@id': stub.url,
                    '@type': 'Movie',
                    'name': title,
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

function createStub(title?: string): Movie {
    return tap(new Movie({ title: title ?? Faker.name.title() }), stub => {
        stub.mintUrl();

        engine.database[Movie.collection] = {
            [stub.requireDocumentUrl()]: {
                '@graph': [stub.toJsonLD()],
            } as EngineDocument,
        };
    });
}
