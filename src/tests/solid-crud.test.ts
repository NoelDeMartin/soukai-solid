import { bootModels, setEngine } from 'soukai';
import { tap, urlResolve, urlResolveDirectory } from '@noeldemartin/utils';
import { faker } from '@noeldemartin/faker';

import Group from '@/testing/lib/stubs/Group';
import Movie from '@/testing/lib/stubs/Movie';
import Person from '@/testing/lib/stubs/Person';
import StubFetcher from '@/testing/lib/stubs/StubFetcher';
import WatchAction from '@/testing/lib/stubs/WatchAction';

import { fakeDocumentUrl, loadFixture } from '@/testing/utils';
import { SolidEngine } from '@/engines/SolidEngine';
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
        bootModels({ Movie, Person, WatchAction, Group });
    });

    it('Creates models', async () => {
        // Arrange
        const title = faker.lorem.sentence();
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
        const title = faker.lorem.sentence();
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
        const title = faker.lorem.sentence();
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
        movie.setAttribute('releaseDate', null);

        await movie.save();

        // Assert
        expect(movie.title).toBe(title);
        expect(fetch).toHaveBeenCalledTimes(2);

        expect(fetch.mock.calls[1]?.[1]?.body).toEqualSparql(`
            DELETE DATA {
                <#it>
                    <${IRI('schema:name')}> "${stub.title}" ;
                    <${IRI('schema:datePublished')}>
                        "${stub.releaseDate?.toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
            } ;
            INSERT DATA {
                <#it>
                    <${IRI('schema:name')}> "${title}" ;
                    <${IRI('schema:sameAs')}> <https://example.org/one>, <https://example.org/two> .
            }
        `);
    });

    it('Updates array fields', async () => {
        // Arrange
        const movie = await createStub();
        const urls = movie.externalUrls.slice(0);

        StubFetcher.addFetchResponse();

        // Act
        await movie.update({ externalUrls: [] });

        // Assert
        expect(movie.externalUrls).toEqual([]);
        expect(fetch).toHaveBeenCalledTimes(2);

        expect(fetch.mock.calls[1]?.[1]?.body).toEqualSparql(`
            DELETE DATA {
                <#it> <${IRI('schema:sameAs')}> ${urls.map(url => `<${url}>`).join(', ')} .
            }
        `);
    });

    it('Reads single models', async () => {
        // Arrange
        StubFetcher.addFetchResponse(fixture('spirited-away.ttl'), {
            'WAC-Allow': 'public="read"',
        });

        // Act
        const movie = await Movie.find('solid://movies/spirited-away#it') as Movie;

        // Assert
        expect(movie).toBeInstanceOf(Movie);
        expect(movie.url).toEqual('solid://movies/spirited-away#it');
        expect(movie.title).toEqual('Spirited Away');
        expect(movie.releaseDate?.getFullYear()).toEqual(2001);
        expect(movie.releaseDate?.getMonth()).toEqual(6);
        expect(movie.releaseDate?.getDate()).toEqual(20);
        expect(movie.isPublic).toEqual(true);
        expect(movie.isPrivate).toEqual(false);

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

    it('Reads many models from containers', async () => {
        // Arrange
        StubFetcher.addFetchResponse(fixture('movies-container.ttl'));
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

    it('Reads many models from documents', async () => {
        // Arrange
        const documentUrl = fakeDocumentUrl();

        StubFetcher.addFetchResponse(fixture('movies-document.ttl'));

        // Act
        const movies = await Movie.all({ $in: [documentUrl] });

        // Assert
        expect(movies).toHaveLength(2);
        const spiritedAway = movies.find(movie => movie.url.endsWith('#spirited-away')) as Movie;
        const theLordOfTheRings = movies.find(movie => movie.url.endsWith('#the-lord-of-the-rings')) as Movie;

        expect(spiritedAway).not.toBeUndefined();
        expect(spiritedAway.title).toEqual('Spirited Away');
        expect(spiritedAway.actions).toHaveLength(1);

        expect(theLordOfTheRings).not.toBeUndefined();
        expect(theLordOfTheRings.title).toEqual('The Lord of the Rings: The Fellowship of the Ring');
        expect(theLordOfTheRings.actions).toHaveLength(0);

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch.mock.calls[0]?.[0]).toEqual(documentUrl);
    });

    it('Deletes models', async () => {
        // Arrange
        const containerUrl = urlResolveDirectory(faker.internet.url());
        const documentUrl = urlResolve(containerUrl, faker.datatype.uuid());
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
        const title = faker.lorem.sentence();
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

    it('Deletes related models in existing documents', async () => {
        // Arrange
        const documentUrl = fakeDocumentUrl();
        const groupName = faker.lorem.sentence();
        const memberName = faker.lorem.sentence();
        const group = new Group({
            url: `${documentUrl}#group`,
            name: groupName,
            memberUrls: [`${documentUrl}#member`],
        }, true);
        const member = new Person({ url: `${documentUrl}#member`, name: memberName }, true);

        group.setRelationModels('members', [member]);

        const documentTurtle = `
            @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
            @prefix foaf: <http://xmlns.com/foaf/0.1/>.

            <#it> rdfs:label "Groups" .

            <#group>
                a foaf:Group ;
                foaf:name "${groupName}" ;
                foaf:member <#member> .

            <#member>
                a foaf:Person ;
                foaf:name "${memberName}" .
        `;

        // TODO this could be improved to fetch only once
        StubFetcher.addFetchResponse(documentTurtle); // Fetch document
        StubFetcher.addFetchResponse(); // PATCH document

        // Act
        await group.relatedMembers.remove(member);

        // Assert
        expect(fetch).toHaveBeenCalledTimes(2);

        expect(fetch.mock.calls[1]?.[0]).toEqual(documentUrl);
        expect(fetch.mock.calls[1]?.[1]?.method).toEqual('PATCH');
        expect(fetch.mock.calls[1]?.[1]?.body).toEqualSparql(`
            DELETE DATA {
                @prefix foaf: <http://xmlns.com/foaf/0.1/>.

                <#group> foaf:member <#member> .

                <#member>
                    a foaf:Person ;
                    foaf:name "${memberName}" .
            }
        `);
    });

});

async function createStub(title?: string): Promise<Movie> {
    const attributes = {
        title: title ?? faker.lorem.sentence(),
        externalUrls: [
            'https://example.org/foo',
            'https://example.org/bar',
        ],
        releaseDate: new Date(),
    };

    return tap(new Movie(attributes, true), async stub => {
        stub.mintUrl();
        stub.cleanDirty();

        const document = await RDFDocument.fromJsonLD(stub.toJsonLD());
        const turtle = RDFResourceProperty.toTurtle(
            document.properties,
            document.url,
        );

        StubFetcher.addFetchResponse(turtle);
    });
}
