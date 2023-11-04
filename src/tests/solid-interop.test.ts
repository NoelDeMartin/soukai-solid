import { bootModels, setEngine } from 'soukai';
import { faker } from '@noeldemartin/faker';

import Movie from '@/testing/lib/stubs/Movie';
import StubFetcher from '@/testing/lib/stubs/StubFetcher';
import WatchAction from '@/testing/lib/stubs/WatchAction';
import { loadFixture } from '@/testing/utils';

import SolidContainer from '@/models/SolidContainer';
import SolidDocument from '@/models/SolidDocument';
import { SolidEngine } from '@/engines/SolidEngine';
import { fakeDocumentUrl } from '@noeldemartin/solid-utils';

class MovieWithTimestamps extends Movie {

    public static timestamps = true;

}

const fixture = (name: string) => loadFixture(`solid-interop/${name}`);

describe('Solid Interoperability', () => {

    let fetch: jest.Mock<Promise<Response>, [RequestInfo, RequestInit?]>;

    beforeEach(() => {
        fetch = jest.fn((...args) => StubFetcher.fetch(...args));
        Movie.collection = 'https://my-pod.com/movies/';

        setEngine(new SolidEngine(fetch));
        bootModels({ Movie, WatchAction, MovieWithTimestamps });
    });

    it('Fixes malformed attributes', async () => {
        // Arrange
        const turtle = `
            @prefix schema: <https://schema.org/>.

            <#it>
                a schema:Movie;
                schema:name "Spirited Away";
                schema:image "https://www.themoviedb.org/t/p/w600_and_h900_bestv2/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg";
                schema:sameAs "https://www.imdb.com/title/tt0245429", "https://www.themoviedb.org/movie/129" .
        `;

        StubFetcher.addFetchResponse(turtle);
        StubFetcher.addFetchResponse(turtle);
        StubFetcher.addFetchResponse();

        // Act
        const movie = await MovieWithTimestamps.find('solid://movies/spirited-away#it') as MovieWithTimestamps;
        const malformations = movie.getMalformedDocumentAttributes();

        movie.fixMalformedAttributes();

        await movie.withoutTimestamps(() => movie.save());

        // Assert
        expect(malformations);
        expect(fetch).toHaveBeenCalledTimes(3);

        expect(fetch.mock.calls[2]?.[1]?.body).toEqualSparql(`
            DELETE DATA {
                @prefix schema: <https://schema.org/>.

                <#it>
                    schema:image "https://www.themoviedb.org/t/p/w600_and_h900_bestv2/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg" ;
                    schema:sameAs "https://www.imdb.com/title/tt0245429", "https://www.themoviedb.org/movie/129" .
            } ;
            INSERT DATA {
                @prefix schema: <https://schema.org/>.
                @prefix crdt: <https://vocab.noeldemartin.com/crdt/>.
                @prefix xsd: <http://www.w3.org/2001/XMLSchema#>.

                <#it>
                    schema:image <https://www.themoviedb.org/t/p/w600_and_h900_bestv2/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg> ;
                    schema:sameAs <https://www.imdb.com/title/tt0245429>, <https://www.themoviedb.org/movie/129> .

                <#it-metadata>
                    a crdt:Metadata ;
                    crdt:resource <#it> ;
                    crdt:createdAt "[[date][.*]]"^^xsd:dateTime ;
                    crdt:updatedAt "[[date][.*]]"^^xsd:dateTime .
            }
        `);
    });

    it('Reads http and https schemes', async () => {
        // Arrange
        const turtle = `
            @prefix schema: <http://schema.org/>.

            <#it>
                a schema:Movie;
                schema:name "Spirited Away".
        `;

        StubFetcher.addFetchResponse(turtle);

        // Act
        Movie.aliasRdfPrefixes({ 'https://schema.org': 'http://schema.org' });

        const movies = await Movie.all({ $in: ['solid://movies/spirited-away#it'] });

        // Assert
        expect(movies).toHaveLength(1);
        expect(movies[0]?.title).toEqual('Spirited Away');
        expect(movies[0]?.usesRdfAliases()).toBe(true);
    });

    it('Reads instances from the type index', async () => {
        // Arrange
        const podUrl = faker.internet.url();
        const typeIndexUrl = fakeDocumentUrl({ baseUrl: podUrl });
        const movieUrl = `${podUrl}/movies/spirited-away`;

        StubFetcher.addFetchResponse(fixture('type-index.ttl'));

        // Act
        const movieDocuments = await SolidDocument.fromTypeIndex(typeIndexUrl, Movie);

        // Assert
        expect(movieDocuments).toHaveLength(1);
        expect(movieDocuments[0]?.url).toEqual(movieUrl);
    });

    it('Reads containers from the type index', async () => {
        // Arrange
        const podUrl = faker.internet.url();
        const typeIndexUrl = fakeDocumentUrl({ baseUrl: podUrl });
        const moviesContainerUrl = `${podUrl}/movies`;

        StubFetcher.addFetchResponse(fixture('type-index.ttl'));

        // Act
        const movieContainers = await SolidContainer.fromTypeIndex(typeIndexUrl, Movie);

        // Assert
        expect(movieContainers).toHaveLength(1);
        expect(movieContainers[0]?.url).toEqual(moviesContainerUrl);
    });

    it('Registers instances in the type index', async () => {
        // Arrange
        const podUrl = faker.internet.url();
        const typeIndexUrl = fakeDocumentUrl({ baseUrl: podUrl });
        const movieDocumentUrl = `${podUrl}/movies/midsommar`;
        const movieUrl = `${movieDocumentUrl}#it`;

        StubFetcher.addFetchResponse(fixture('type-index.ttl'));
        StubFetcher.addFetchResponse();

        // Act
        const movie = new Movie({ url: movieUrl });

        await movie.registerInTypeIndex(typeIndexUrl);

        // Assert
        expect(fetch).toHaveBeenCalledTimes(2);

        expect(fetch.mock.calls[1]?.[1]?.body).toEqualSparql(`
            INSERT DATA {
                @prefix solid: <http://www.w3.org/ns/solid/terms#> .
                @prefix schema: <https://schema.org/>.

                <#[[.*]]> a solid:TypeRegistration;
                    solid:forClass schema:Movie;
                    solid:instance <${movieDocumentUrl}>.
            }
        `);
    });

    it('Registers containers in the type index', async () => {
        // Arrange
        const podUrl = faker.internet.url();
        const typeIndexUrl = fakeDocumentUrl({ baseUrl: podUrl });
        const moviesContainerUrl = `${podUrl}/great-movies`;

        StubFetcher.addFetchResponse(fixture('type-index.ttl'));
        StubFetcher.addFetchResponse();

        // Act
        const movies = new SolidContainer({ url: moviesContainerUrl });

        await movies.register(typeIndexUrl, Movie);

        // Assert
        expect(fetch).toHaveBeenCalledTimes(2);

        expect(fetch.mock.calls[1]?.[1]?.body).toEqualSparql(`
            INSERT DATA {
                @prefix solid: <http://www.w3.org/ns/solid/terms#> .
                @prefix schema: <https://schema.org/>.

                <#[[.*]]> a solid:TypeRegistration;
                    solid:forClass schema:Movie;
                    solid:instanceContainer <${moviesContainerUrl}>.
            }
        `);
    });

});
