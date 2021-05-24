import { bootModels, setEngine } from 'soukai';

import { SolidEngine } from '@/engines';

import BasePerson from '@/testing/lib/stubs/Person';
import StubFetcher from '@/testing/lib/stubs/StubFetcher';
import { loadFixture } from '@/testing/utils';

class Person extends BasePerson {

    public static timestamps = true;
    public static history = true;

}

describe('Solid history tracking', () => {

    let fetch: jest.Mock<Promise<Response>, [RequestInfo, RequestInit?]>;

    beforeEach(() => {
        fetch = jest.fn((...args) => StubFetcher.fetch(...args));

        setEngine(new SolidEngine(fetch));
        bootModels({ Person });
    });

    it('Updates metadata and creates operations', async () => {
        // Arrange
        const fixture = (name: string) => loadFixture(`solid-history-operations/${name}`);

        // Arrange - stub create requests
        StubFetcher.addFetchNotFoundResponse();
        StubFetcher.addFetchResponse();

        // Arrange - stub first update requests
        StubFetcher.addFetchResponse(fixture('document-1.ttl'));
        StubFetcher.addFetchResponse();

        // Arrange - stub second update requests
        StubFetcher.addFetchResponse(fixture('document-2.ttl'));
        StubFetcher.addFetchResponse();

        // Act
        const griffith = await Person.create({ name: 'Griffith' });

        await griffith.update({ name: 'Femto', givenName: 'Wings of Darkness' });
        await griffith.update({ name: 'Griffith', givenName: 'Falcon of Light' });

        // Assert
        expect(fetch).toHaveBeenCalledTimes(6);
        expect(fetch.mock.calls[1][1]?.body).toEqualSparql(fixture('create.sparql'));
        expect(fetch.mock.calls[3][1]?.body).toEqualSparql(fixture('update-1.sparql'));
        expect(fetch.mock.calls[5][1]?.body).toEqualSparql(fixture('update-2.sparql'));
    });

});
