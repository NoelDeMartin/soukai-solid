import { bootModels, setEngine } from 'soukai';

import { SolidEngine } from '@/engines';

import BaseGroup from '@/testing/lib/stubs/Group';
import BasePerson from '@/testing/lib/stubs/Person';
import StubFetcher from '@/testing/lib/stubs/StubFetcher';
import { loadFixture } from '@/testing/utils';
import { arrayWithout } from '@noeldemartin/utils';

class Person extends BasePerson {

    public static timestamps = true;
    public static history = true;

}

class Group extends BaseGroup {

    public static timestamps = true;
    public static history = true;

}

const fixture = (name: string) => loadFixture(`solid-history/${name}`);

describe('Solid history tracking', () => {

    let fetch: jest.Mock<Promise<Response>, [RequestInfo, RequestInit?]>;

    beforeEach(() => {
        fetch = jest.fn((...args) => StubFetcher.fetch(...args));

        setEngine(new SolidEngine(fetch));
        bootModels({ Person, Group });
    });

    it('Updates metadata and creates operations', async () => {
        // Arrange - stub create requests
        StubFetcher.addFetchNotFoundResponse();
        StubFetcher.addFetchResponse();

        // Arrange - stub first update requests
        StubFetcher.addFetchResponse(fixture('griffith-1.ttl'));
        StubFetcher.addFetchResponse();

        // Arrange - stub second update requests
        StubFetcher.addFetchResponse(fixture('griffith-2.ttl'));
        StubFetcher.addFetchResponse();

        // Act
        const griffith = await Person.create({ name: 'Griffith' });

        await griffith.update({ name: 'Femto', givenName: 'Wings of Darkness' });
        await griffith.update({ name: 'Griffith', givenName: 'Falcon of Light' });

        // Assert
        expect(fetch).toHaveBeenCalledTimes(6);
        expect(fetch.mock.calls[1][1]?.body).toEqualSparql(fixture('create-griffith.sparql'));
        expect(fetch.mock.calls[3][1]?.body).toEqualSparql(fixture('update-griffith-1.sparql'));
        expect(fetch.mock.calls[5][1]?.body).toEqualSparql(fixture('update-griffith-2.sparql'));
    });

    it('Tracks list operations', async () => {
        // Arrange - stub create requests
        StubFetcher.addFetchNotFoundResponse();
        StubFetcher.addFetchResponse();

        // Arrange - stub first update requests
        StubFetcher.addFetchResponse(fixture('band-of-the-falcon-1.ttl'));
        StubFetcher.addFetchResponse();

        // Arrange - stub second update requests
        StubFetcher.addFetchResponse(fixture('band-of-the-falcon-2.ttl'));
        StubFetcher.addFetchResponse();

        // Arrange - stub third update requests
        StubFetcher.addFetchResponse(fixture('band-of-the-falcon-3.ttl'));
        StubFetcher.addFetchResponse();

        // Act - create band
        const band = await Group.create({
            name: 'Band of the Falcon',
            memberUrls: [
                'https://berserk.fandom.com/wiki/Griffith',
                'https://berserk.fandom.com/wiki/Casca',
                'https://berserk.fandom.com/wiki/Judeau',
                'https://berserk.fandom.com/wiki/Pippin',
                'https://berserk.fandom.com/wiki/Corkus',
            ],
        });

        // Act - Guts joins the band
        await band.update({ memberUrls: [...band.memberUrls, 'https://berserk.fandom.com/wiki/Guts'] });

        // Act - Judeau, Pippin and Corkus are expelled from the band
        await band.update({
            memberUrls: arrayWithout(band.memberUrls, [
                'https://berserk.fandom.com/wiki/Judeau',
                'https://berserk.fandom.com/wiki/Pippin',
                'https://berserk.fandom.com/wiki/Corkus',
            ]),
        });

        // Act - Guts and Casca leave the band, Zodd joins
        await band.update({
            memberUrls: [
                ...arrayWithout(band.memberUrls, [
                    'https://berserk.fandom.com/wiki/Guts',
                    'https://berserk.fandom.com/wiki/Casca',
                ]),
                'https://berserk.fandom.com/wiki/Zodd',
            ],
        });

        // Assert
        expect(fetch).toHaveBeenCalledTimes(8);
        expect(fetch.mock.calls[1][1]?.body).toEqualSparql(fixture('create-band-of-the-falcon.sparql'));
        expect(fetch.mock.calls[3][1]?.body).toEqualSparql(fixture('update-band-of-the-falcon-1.sparql'));
        expect(fetch.mock.calls[5][1]?.body).toEqualSparql(fixture('update-band-of-the-falcon-2.sparql'));
        expect(fetch.mock.calls[7][1]?.body).toEqualSparql(fixture('update-band-of-the-falcon-3.sparql'));
    });

});
