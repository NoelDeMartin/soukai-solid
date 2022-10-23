import { bootModels, setEngine } from 'soukai';

import Movie from '@/testing/lib/stubs/Movie';
import StubFetcher from '@/testing/lib/stubs/StubFetcher';
import WatchAction from '@/testing/lib/stubs/WatchAction';

import { SolidEngine } from '@/engines';

describe('Solid Interoperability', () => {

    let fetch: jest.Mock<Promise<Response>, [RequestInfo, RequestInit?]>;

    beforeEach(() => {
        fetch = jest.fn((...args) => StubFetcher.fetch(...args));
        Movie.collection = 'https://my-pod.com/movies/';

        setEngine(new SolidEngine(fetch));
        bootModels({ Movie, WatchAction });
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
        const movie = await Movie.find('solid://movies/spirited-away#it') as Movie;
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

                <#it>
                    schema:image <https://www.themoviedb.org/t/p/w600_and_h900_bestv2/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg> ;
                    schema:sameAs <https://www.imdb.com/title/tt0245429>, <https://www.themoviedb.org/movie/129> .
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

});
