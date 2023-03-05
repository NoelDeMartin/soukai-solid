import { faker } from '@noeldemartin/faker';
import { bootModels, setEngine } from 'soukai';
import { SolidDocumentPermission } from '@noeldemartin/solid-utils';

import { SolidEngine } from '@/engines';
import { SolidACLAuthorization } from '@/models';

import Movie from '@/testing/lib/stubs/Movie';
import StubFetcher from '@/testing/lib/stubs/StubFetcher';
import { fakeDocumentUrl } from '@/testing/utils';

describe('WAC', () => {

    let fetch: jest.Mock<Promise<Response>, [RequestInfo, RequestInit?]>;

    beforeEach(() => {
        fetch = jest.fn((...args) => StubFetcher.fetch(...args));
        Movie.collection = 'https://my-pod.com/movies/';

        setEngine(new SolidEngine(fetch));
        bootModels({ Movie, SolidACLAuthorization });
    });

    it('Makes private documents public', async () => {
        // Arrange
        const documentUrl = fakeDocumentUrl();
        const movie = new Movie({
            url: `${documentUrl}#it`,
            name: faker.random.word(),
        }, true);

        StubFetcher.addFetchResponse('', { 'WAC-Allow': 'user="append control read write"' });
        StubFetcher.addFetchResponse('', { Link: `<${documentUrl}.acl>; rel="acl"` });
        StubFetcher.addFetchResponse(`
            @prefix acl: <http://www.w3.org/ns/auth/acl#> .

            <#owner>
                a acl:Authorization ;
                acl:agent <owner> ;
                acl:accessTo <${documentUrl}> ;
                acl:mode acl:Read, acl:Write, acl:Control .
        `);
        StubFetcher.addFetchResponse(); // GET documentExists
        StubFetcher.addFetchResponse(); // PATCH update

        // Act
        await movie.fetchPublicPermissionsIfMissing();
        await movie.updatePublicPermissions([SolidDocumentPermission.Read]);

        // Assert
        expect(movie.isPublic).toBe(true);
        expect(fetch).toHaveBeenCalledTimes(5);

        expect(fetch.mock.calls[4]?.[1]?.body).toEqualSparql(`
            INSERT DATA {
                @prefix acl: <http://www.w3.org/ns/auth/acl#> .
                @prefix foaf: <http://xmlns.com/foaf/0.1/> .

                <#public>
                    a acl:Authorization ;
                    acl:agentClass foaf:Agent ;
                    acl:accessTo <${documentUrl}> ;
                    acl:mode acl:Read .
            }
        `);
    });

});
