import { bootModels, setEngine } from 'soukai';
import { fakeDocumentUrl } from '@noeldemartin/solid-utils';
import { faker } from '@noeldemartin/faker';

import SolidContainer from '@/models/SolidContainer';
import SolidDocument from '@/models/SolidDocument';
import { SolidEngine } from '@/engines/SolidEngine';

import Group from '@/testing/lib/stubs/Group';
import Movie from '@/testing/lib/stubs/Movie';
import Person from '@/testing/lib/stubs/Person';
import StubFetcher from '@/testing/lib/stubs/StubFetcher';
import WatchAction from '@/testing/lib/stubs/WatchAction';
import { loadFixture } from '@/testing/utils';

const fixture = (name: string) => loadFixture(`interoperability/${name}`);

describe('Interoperability', () => {

    let fetch: jest.Mock<Promise<Response>, [RequestInfo, RequestInit?]>;

    beforeEach(() => {
        fetch = jest.fn((...args) => StubFetcher.fetch(...args));
        Movie.collection = 'https://my-pod.com/movies/';

        setEngine(new SolidEngine(fetch));
        bootModels({ Movie, Person, WatchAction, Group });
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
