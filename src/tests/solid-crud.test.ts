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

describe('CRUD', () => {

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
        const name = Faker.name.title();
        const stub = await createStub();
        const movie = new Movie(stub.getAttributes(), true);

        StubFetcher.addFetchResponse();

        // Act
        await movie.update({ name });

        // Assert
        expect(movie.name).toBe(name);
        expect(fetch).toHaveBeenCalledTimes(2);

        await expect(fetch.mock.calls[1][1]?.body).toEqualSPARQL(`
            DELETE DATA { <#it> <${IRI('schema:name')}> "${stub.name}" . } ;
            INSERT DATA { <#it> <${IRI('schema:name')}> "${name}" . }
        `);
    });

    it.todo('Reads models');

    it.todo('Deletes models');

});

async function createStub(name?: string): Promise<Movie> {
    return tap(new Movie({ name: name ?? Faker.name.title() }), async stub => {
        stub.mintUrl();

        const document = await RDFDocument.fromJsonLD(stub.toJsonLD());
        const turtle = RDFResourceProperty.toTurtle(
            document.properties,
            document.url,
        );

        StubFetcher.addFetchResponse(turtle);
    });
}
