import { bootModels, setEngine } from 'soukai';
import { tap } from '@noeldemartin/utils';
import Faker from 'faker';

import Movie from '@/testing/lib/stubs/Movie';
import StubFetcher from '@/testing/lib/stubs/StubFetcher';
import WatchAction from '@/testing/lib/stubs/WatchAction';

import { loadFixture } from '@/testing/utils';
import { SolidEngine } from '@/engines';
import IRI from '@/solid/utils/IRI';
import RDFDocument from '@/solid/RDFDocument';
import RDFResourceProperty from '@/solid/RDFResourceProperty';

const fixture = (name: string) => loadFixture(`solid-crud/${name}`);

describe('Solid CRUD', () => {

    let fetch: jest.Mock<Promise<Response>, [RequestInfo, RequestInit?]>;

    beforeEach(() => {
        fetch = jest.fn((...args) => StubFetcher.fetch(...args));
        Movie.collection = 'https://my-pod.com/movies/';

        setEngine(new SolidEngine(fetch));
        bootModels({ Movie, WatchAction });
    });

    it.todo('Creates models');

    it('Updates models', async () => {
        // Arrange
        const title = Faker.name.title();
        const stub = await createStub();
        const movie = new Movie(stub.getAttributes(), true);

        StubFetcher.addFetchResponse();

        // Act
        await movie.update({ title });

        // Assert
        expect(movie.title).toBe(title);
        expect(fetch).toHaveBeenCalledTimes(2);

        await expect(fetch.mock.calls[1][1]?.body).toEqualSparql(`
            DELETE DATA { <#it> <${IRI('schema:name')}> "${stub.title}" . } ;
            INSERT DATA { <#it> <${IRI('schema:name')}> "${title}" . }
        `);
    });

    it.todo('Reads models');

    it('Reads many models', async () => {
        // Arrange
        StubFetcher.addFetchResponse(fixture('movies.ttl'));
        StubFetcher.addFetchResponse(fixture('the-lord-of-the-rings.ttl'));
        StubFetcher.addFetchResponse(fixture('spirited-away.ttl'));
        StubFetcher.addFetchResponse(fixture('ramen.ttl'));

        // Act
        const movies = await Movie.all();

        // Assert
        expect(movies).toHaveLength(2);
        const theLordOfTheRings = movies.find(movie => movie.url.endsWith('the-lord-of-the-rings#it')) as Movie;
        const spiritedAway = movies.find(movie => movie.url.endsWith('spirited-away#it')) as Movie;

        expect(theLordOfTheRings).not.toBeUndefined();
        expect(theLordOfTheRings.title).toEqual('The Lord of the Rings: The Fellowship of the Ring');
        expect(theLordOfTheRings.actions).toHaveLength(0);

        expect(spiritedAway).not.toBeUndefined();
        expect(spiritedAway.title).toEqual('Spirited Away');
        expect(spiritedAway.actions).toHaveLength(1);
    });

    it.todo('Deletes models');

});

async function createStub(title?: string): Promise<Movie> {
    const attributes = {
        title: title ?? Faker.name.title(),
    };

    return tap(new Movie(attributes), async stub => {
        stub.mintUrl();

        const document = await RDFDocument.fromJsonLD(stub.toJsonLD());
        const turtle = RDFResourceProperty.toTurtle(
            document.properties,
            document.url,
        );

        StubFetcher.addFetchResponse(turtle);
    });
}
