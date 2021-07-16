import { bootModels, setEngine } from 'soukai';
import { tap } from '@noeldemartin/utils';
import Faker from 'faker';

import Movie from '@/testing/lib/stubs/Movie';
import StubFetcher from '@/testing/lib/stubs/StubFetcher';
import WatchAction from '@/testing/lib/stubs/WatchAction';

import { SolidEngine } from '@/engines';
import IRI from '@/solid/utils/IRI';
import RDFDocument from '@/solid/RDFDocument';
import RDFResourceProperty from '@/solid/RDFResourceProperty';

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
        const containerUrl = 'https://my-pod.com/movies/';

        StubFetcher.addFetchResponse(`
            @prefix : <${containerUrl}>.
            @prefix dc: <http://purl.org/dc/terms/>.
            @prefix ldp: <http://www.w3.org/ns/ldp#>.
            @prefix posix: <http://www.w3.org/ns/posix/stat#>.
            @prefix xsd: <http://www.w3.org/2001/XMLSchema#>.
            @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.

            : a ldp:Container, ldp:BasicContainer, ldp:Resource;
                rdfs:label "Movies";
                dc:created "2021-01-16T12:10:55Z"^^xsd:dateTime;
                dc:modified "2021-04-15T18:50:25.677Z"^^xsd:dateTime;
                posix:mtime 1618512625;
                ldp:contains :the-lord-of-the-rings, :spirited-away, :ramen.

            :the-lord-of-the-rings a ldp:Resource;
                dc:modified "2021-01-16T12:12:51.731Z"^^xsd:dateTime;
                posix:mtime 1610799171;
                posix:size 3398.

            :spirited-away a ldp:Resource;
                dc:modified "2021-04-15T18:47:46.807Z"^^xsd:dateTime;
                posix:mtime 1618512466;
                posix:size 1982.

            :ramen a ldp:Resource;
                dc:modified "2021-04-15T18:57:11.746Z"^^xsd:dateTime;
                posix:mtime 1618513031;
                posix:size 2941.
        `);

        StubFetcher.addFetchResponse(`
            @prefix : <#>.
            @prefix schema: <https://schema.org/>.
            @prefix terms: <http://purl.org/dc/terms/>.
            @prefix XML: <http://www.w3.org/2001/XMLSchema#>.

            :it
                a schema:Movie;
                terms:created "2021-01-30T11:47:24Z"^^XML:dateTime;
                terms:modified "2021-01-30T11:47:24Z"^^XML:dateTime;
                schema:datePublished "2001-12-18T00:00:00Z"^^XML:dateTime;
                schema:name "The Lord of the Rings: The Fellowship of the Ring".
        `);

        StubFetcher.addFetchResponse(`
            @prefix : <#>.
            @prefix schema: <https://schema.org/>.
            @prefix terms: <http://purl.org/dc/terms/>.
            @prefix XML: <http://www.w3.org/2001/XMLSchema#>.

            :it
                a schema:Movie;
                terms:created "2021-01-30T11:47:00Z"^^XML:dateTime;
                terms:modified "2021-01-30T11:47:00Z"^^XML:dateTime;
                schema:datePublished "2001-07-20T00:00:00Z"^^XML:dateTime;
                schema:name "Spirited Away".

            :59344285-7e11-4b88-aea0-544a2044a7e8
                a schema:WatchAction;
                terms:created "2020-12-10T19:20:57Z"^^XML:dateTime;
                schema:endTime "2020-12-10T19:20:57Z"^^XML:dateTime;
                schema:object :it;
                schema:startTime "2020-12-10T19:20:57Z"^^XML:dateTime.
        `);

        StubFetcher.addFetchResponse(`
            @prefix : <#>.
            @prefix schema: <https://schema.org/>.
            @prefix terms: <http://purl.org/dc/terms/>.
            @prefix XML: <http://www.w3.org/2001/XMLSchema#>.

            :it
                a schema:Recipe;
                terms:created "2021-01-30T11:47:00Z"^^XML:dateTime;
                terms:modified "2021-01-30T11:47:00Z"^^XML:dateTime;
                schema:name "Ramen".
        `);

        // Act
        const movies = await Movie.from(containerUrl).all();

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
