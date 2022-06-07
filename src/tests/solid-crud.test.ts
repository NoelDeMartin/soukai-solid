import { bootModels, setEngine } from 'soukai';
import { tap, urlResolve, urlResolveDirectory } from '@noeldemartin/utils';
import Faker from 'faker';

import Movie from '@/testing/lib/stubs/Movie';
import Person from '@/testing/lib/stubs/Person';
import StubFetcher from '@/testing/lib/stubs/StubFetcher';
import WatchAction from '@/testing/lib/stubs/WatchAction';

import { fakeDocumentUrl, loadFixture } from '@/testing/utils';
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
        bootModels({ Movie, Person, WatchAction });
    });

    it('Creates models', async () => {
        // Arrange
        const title = Faker.name.title();
        const releaseDate = new Date('1997-07-21T23:42:00Z');
        const watchDate = new Date('2002-09-15T23:42:00Z');

        StubFetcher.addFetchResponse();
        StubFetcher.addFetchResponse();

        // Act
        const movie = new Movie({ title, releaseDate });

        movie.relatedActions.create({ startTime: watchDate });

        await movie.save();

        // Assert
        expect(fetch).toHaveBeenCalledTimes(2);

        expect(fetch.mock.calls[1]?.[1]?.body).toEqualSparql(`
            INSERT DATA {
                @prefix schema: <https://schema.org/>.

                <#it>
                    a schema:Movie ;
                    schema:name "${title}" ;
                    schema:datePublished "${releaseDate.toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .

                <#[[.*]]>
                    a schema:WatchAction ;
                    schema:object <#it> ;
                    schema:startTime "${watchDate.toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
            }
        `);
    });

    it('Creates models in existing documents', async () => {
        // Arrange
        const title = Faker.name.title();
        const watchDate = new Date('2002-09-15T23:42:00Z');
        const movie = new Movie({ title });
        const documentUrl = fakeDocumentUrl();

        await movie.relatedActions.create({ startTime: watchDate });

        StubFetcher.addFetchResponse(`
            @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.

            <#it> rdfs:label "Movies" .
        `);
        StubFetcher.addFetchResponse();

        // Act
        await movie.saveInDocument(documentUrl, 'movie');

        // Assert
        expect(fetch).toHaveBeenCalledTimes(2);

        expect(fetch.mock.calls[1]?.[0]).toEqual(documentUrl);
        expect(fetch.mock.calls[1]?.[1]?.body).toEqualSparql(`
            INSERT DATA {
                @prefix schema: <https://schema.org/>.

                <#movie>
                    a schema:Movie ;
                    schema:name "${title}" .

                <#[[.*]]>
                    a schema:WatchAction ;
                    schema:object <#movie> ;
                    schema:startTime "${watchDate.toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
            }
        `);
    });

    it('Updates models', async () => {
        // Arrange
        const title = Faker.name.title();
        const stub = await createStub();
        const movie = new Movie(stub.getAttributes(), true);

        StubFetcher.addFetchResponse();

        // Act
        movie.setAttribute('title', title);
        movie.setAttribute('externalUrls', [
            ...movie.externalUrls,
            'https://example.org/one',
            'https://example.org/two',
        ]);

        await movie.save();

        // Assert
        expect(movie.title).toBe(title);
        expect(fetch).toHaveBeenCalledTimes(2);

        expect(fetch.mock.calls[1]?.[1]?.body).toEqualSparql(`
            DELETE DATA { <#it> <${IRI('schema:name')}> "${stub.title}" . } ;
            INSERT DATA {
                <#it>
                    <${IRI('schema:name')}> "${title}" ;
                    <${IRI('schema:sameAs')}> <https://example.org/one>, <https://example.org/two> .
            }
        `);
    });

    it('Reads models', async () => {
        // Arrange
        StubFetcher.addFetchResponse(fixture('spirited-away.ttl'));

        // Act
        const movie = await Movie.find('solid://spirited-away#it') as Movie;

        // Assert
        expect(movie).toBeInstanceOf(Movie);
        expect(movie.url).toEqual('solid://spirited-away#it');
        expect(movie.title).toEqual('Spirited Away');
        expect(movie.releaseDate?.getFullYear()).toEqual(2001);
        expect(movie.releaseDate?.getMonth()).toEqual(6);
        expect(movie.releaseDate?.getDate()).toEqual(20);

        expect(movie.actions).toHaveLength(1);

        const action = movie.actions?.[0] as WatchAction;
        expect(action).toBeInstanceOf(WatchAction);
        expect(action.object).toEqual(movie.url);
        expect(action.startTime?.getFullYear()).toEqual(2020);
        expect(action.startTime?.getMonth()).toEqual(11);
        expect(action.startTime?.getDate()).toEqual(10);
    });

    it('Reads webIds', async () => {
        // Arrange
        StubFetcher.addFetchResponse(fixture('alice.ttl'));

        // Act
        const alice = await Person
            .from('https://alice.pod-provider.com/profile/')
            .find('https://alice.pod-provider.com/profile/card#me');

        // Assert
        expect(alice).not.toBeNull();
        expect(alice?.name).toEqual('Alice');
    });

    it('Reads many models', async () => {
        // Arrange
        StubFetcher.addFetchResponse(fixture('movies.ttl'));
        StubFetcher.addFetchResponse(fixture('the-lord-of-the-rings.ttl'));
        StubFetcher.addFetchResponse(fixture('spirited-away.ttl'));
        StubFetcher.addFetchResponse(fixture('the-tale-of-princess-kaguya.ttl'));
        StubFetcher.addFetchResponse(fixture('ramen.ttl'));

        // Act
        const movies = await Movie.all({ rating: 'PG' });

        // Assert
        expect(movies).toHaveLength(2);
        const theTaleOfPrincessKaguya =
            movies.find(movie => movie.url.endsWith('the-tale-of-princess-kaguya#it')) as Movie;
        const spiritedAway = movies.find(movie => movie.url.endsWith('spirited-away#it')) as Movie;

        expect(theTaleOfPrincessKaguya).not.toBeUndefined();
        expect(theTaleOfPrincessKaguya.title).toEqual('The Tale of The Princess Kaguya');
        expect(theTaleOfPrincessKaguya.actions).toHaveLength(0);

        expect(spiritedAway).not.toBeUndefined();
        expect(spiritedAway.title).toEqual('Spirited Away');
        expect(spiritedAway.actions).toHaveLength(1);
    });

    it('Deletes models', async () => {
        // Arrange
        const containerUrl = urlResolveDirectory(Faker.internet.url());
        const documentUrl = urlResolve(containerUrl, Faker.random.uuid());
        const url = `${documentUrl}#it`;
        const movie = new Movie({ url }, true);

        StubFetcher.addFetchResponse(); // GET to check if there are other models in document
        StubFetcher.addFetchResponse(); // GET to see if document exists
        StubFetcher.addFetchResponse(); // DELETE

        // Act
        await movie.delete();

        // Assert
        expect(movie.exists()).toBe(false);
        expect(movie.documentExists()).toBe(false);

        expect(fetch).toHaveBeenCalledTimes(3);
        expect(fetch.mock.calls[2]?.[0]).toEqual(documentUrl);
        expect(fetch.mock.calls[2]?.[1]?.method).toEqual('DELETE');
    });

    it('Deletes models in existing documents', async () => {
        // Arrange
        const documentUrl = fakeDocumentUrl();
        const title = Faker.name.title();
        const watchDate = new Date('2002-09-15T23:42:00Z');
        const movie = new Movie({ url: `${documentUrl}#movie`, title }, true);
        const action = new WatchAction({ url: `${documentUrl}#action`, startTime: watchDate }, true);

        movie.setRelationModels('actions', [action]);

        const documentTurtle = `
            @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
            @prefix schema: <https://schema.org/>.

            <#it> rdfs:label "Movies" .

            <#movie>
                a schema:Movie ;
                schema:name "${title}" .

            <#action>
                a schema:WatchAction ;
                schema:object <#movie> ;
                schema:startTime "${watchDate.toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
        `;

        // TODO this could be improved to fetch only once
        StubFetcher.addFetchResponse(documentTurtle); // Fetch document to see if it can be deleted entirely
        StubFetcher.addFetchResponse(documentTurtle); // Fetch document under SolidClient.update to prepare PATCH
        StubFetcher.addFetchResponse(); // PATCH document

        // Act
        await movie.delete();

        // Assert
        expect(fetch).toHaveBeenCalledTimes(3);

        expect(fetch.mock.calls[2]?.[0]).toEqual(documentUrl);
        expect(fetch.mock.calls[2]?.[1]?.method).toEqual('PATCH');
        expect(fetch.mock.calls[2]?.[1]?.body).toEqualSparql(`
            DELETE DATA {
                @prefix schema: <https://schema.org/>.

                <#movie>
                    a schema:Movie ;
                    schema:name "${title}" .

                <#action>
                    a schema:WatchAction ;
                    schema:object <#movie> ;
                    schema:startTime "${watchDate.toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
            } ;
        `);
    });

});

async function createStub(title?: string): Promise<Movie> {
    const attributes = {
        title: title ?? Faker.name.title(),
        externalUrls: [
            'https://example.org/foo',
            'https://example.org/bar',
        ],
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
