import { arrayWithout, toString } from '@noeldemartin/utils';
import { ModelKey, bootModels, setEngine } from 'soukai';
import { expandIRI as defaultExpandIRI } from '@noeldemartin/solid-utils';

import { SolidEngine } from '@/engines';

import { loadFixture } from '@/testing/utils';
import BaseGroup from '@/testing/lib/stubs/Group';
import BasePerson from '@/testing/lib/stubs/Person';
import StubFetcher from '@/testing/lib/stubs/StubFetcher';

const expandIRI = (iri: string) => defaultExpandIRI(iri, {
    extraContext: {
        soukai: 'https://soukai.noeldemartin.com/vocab/',
        foaf: 'http://xmlns.com/foaf/0.1/',
    },
});

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

    it('Reads operation values with explicit types', async () => {
        // Arrange
        StubFetcher.addFetchResponse(fixture('band-of-the-falcon-3.ttl'));

        // Act
        const band = await Group.find('solid://band-of-the-falcon#it') as Group;

        // Assert
        expect(band.name).toEqual('Band of the Falcon');
        expect(band.memberUrls).toEqual([
            'https://berserk.fandom.com/wiki/Griffith',
            'https://berserk.fandom.com/wiki/Casca',
            'https://berserk.fandom.com/wiki/Guts',
        ]);
        expect(band.metadata).not.toBeNull();
        expect(band.operations).toHaveLength(4);

        expect(band.metadata.resourceUrl).toEqual('solid://band-of-the-falcon#it');
        expect(band.metadata.createdAt).toBeInstanceOf(Date);
        expect(band.metadata.updatedAt).toBeInstanceOf(Date);

        expect(band.operations[0].resourceUrl).toEqual('solid://band-of-the-falcon#it');
        expect(band.operations[0].type).toBeUndefined();
        expect(band.operations[0].date).toBeInstanceOf(Date);
        expect(band.operations[0].property).toEqual(expandIRI('foaf:name'));
        expect(band.operations[0].value).toEqual('Band of the Falcon');

        expect(band.operations[1].resourceUrl).toEqual('solid://band-of-the-falcon#it');
        expect(band.operations[1].type).toBeUndefined();
        expect(band.operations[1].date).toBeInstanceOf(Date);
        expect(band.operations[1].property).toEqual(expandIRI('foaf:member'));
        expect(band.operations[1].value).toHaveLength(5);
        [
            'https://berserk.fandom.com/wiki/Griffith',
            'https://berserk.fandom.com/wiki/Casca',
            'https://berserk.fandom.com/wiki/Judeau',
            'https://berserk.fandom.com/wiki/Pippin',
            'https://berserk.fandom.com/wiki/Corkus',
        ].forEach((memberUrl, index) => {
            expect(band.operations[1].value[index]).toBeInstanceOf(ModelKey);
            expect(toString(band.operations[1].value[index])).toEqual(memberUrl);
        });

        expect(band.operations[2].resourceUrl).toEqual('solid://band-of-the-falcon#it');
        expect(band.operations[2].type).toEqual(expandIRI('soukai:AddOperation'));
        expect(band.operations[2].date).toBeInstanceOf(Date);
        expect(band.operations[2].property).toEqual(expandIRI('foaf:member'));
        expect(band.operations[2].value).toBeInstanceOf(ModelKey);
        expect(toString(band.operations[2].value)).toEqual('https://berserk.fandom.com/wiki/Guts');

        expect(band.operations[3].resourceUrl).toEqual('solid://band-of-the-falcon#it');
        expect(band.operations[3].type).toEqual(expandIRI('soukai:RemoveOperation'));
        expect(band.operations[3].date).toBeInstanceOf(Date);
        expect(band.operations[3].property).toEqual(expandIRI('foaf:member'));
        expect(band.operations[3].value).toHaveLength(3);
        [
            'https://berserk.fandom.com/wiki/Judeau',
            'https://berserk.fandom.com/wiki/Pippin',
            'https://berserk.fandom.com/wiki/Corkus',
        ].forEach((memberUrl, index) => {
            expect(band.operations[3].value[index]).toBeInstanceOf(ModelKey);
            expect(toString(band.operations[3].value[index])).toEqual(memberUrl);
        });
    });

});
