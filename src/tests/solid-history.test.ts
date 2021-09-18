import { arrayWithout, toString } from '@noeldemartin/utils';
import { ModelKey, bootModels, setEngine } from 'soukai';
import { expandIRI as defaultExpandIRI } from '@noeldemartin/solid-utils';
import type { Relation } from 'soukai';

import { SolidEngine } from '@/engines';
import { SolidModelOperationType } from '@/models/SolidModelOperation';

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

    public creatorRelationship(): Relation {
        return this
            .belongsToOne(Person, 'creatorUrl')
            .usingSameDocument(true)
            .onDelete('cascade');
    }

    public membersRelationship(): Relation {
        return this
            .belongsToMany(Person, 'memberUrls')
            .usingSameDocument(true);
    }

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

        await griffith.update({ name: 'Femto', givenName: 'Wings of Darkness', lastName: null });
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
        const band = new Group({
            name: 'Band of the Falcon',
            memberUrls: [
                'https://berserk.fandom.com/wiki/Griffith',
                'https://berserk.fandom.com/wiki/Casca',
                'https://berserk.fandom.com/wiki/Judeau',
                'https://berserk.fandom.com/wiki/Pippin',
                'https://berserk.fandom.com/wiki/Corkus',
            ],
        });

        const griffith = band.relatedCreator.set({ name: 'Griffith' });

        await band.save();

        // Act - Guts joins the band
        await band.update({ memberUrls: [...band.memberUrls, 'https://berserk.fandom.com/wiki/Guts'] });

        // Act - Judeau, Pippin and Corkus are expelled from the band; Griffith becomes Femto
        band.memberUrls = arrayWithout(band.memberUrls, [
            'https://berserk.fandom.com/wiki/Judeau',
            'https://berserk.fandom.com/wiki/Pippin',
            'https://berserk.fandom.com/wiki/Corkus',
        ]);

        griffith.name = 'Femto';

        await band.save();

        // Act - Guts and Casca leave the band, Zodd joins; Femto becomes Griffith again
        band.memberUrls = [
            ...arrayWithout(band.memberUrls, [
                'https://berserk.fandom.com/wiki/Guts',
                'https://berserk.fandom.com/wiki/Casca',
            ]),
            'https://berserk.fandom.com/wiki/Zodd',
        ];

        griffith.name = 'Griffith';

        await band.save();

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

        // Assert - Band
        expect(band.name).toEqual('Band of the Falcon');
        expect(band.memberUrls).toEqual([
            'https://berserk.fandom.com/wiki/Griffith',
            'https://berserk.fandom.com/wiki/Casca',
            'https://berserk.fandom.com/wiki/Guts',
        ]);
        expect(band.creatorUrl).toEqual('solid://band-of-the-falcon#griffith');
        expect(band.metadata).not.toBeNull();
        expect(band.operations).toHaveLength(5);

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
        expect(band.operations[2].date).toBeInstanceOf(Date);
        expect(band.operations[2].property).toEqual(expandIRI('foaf:maker'));
        expect(band.operations[2].value).toBeInstanceOf(ModelKey);
        expect(toString(band.operations[2].value)).toEqual('solid://band-of-the-falcon#griffith');

        expect(band.operations[3].resourceUrl).toEqual('solid://band-of-the-falcon#it');
        expect(band.operations[3].type).toEqual(SolidModelOperationType.Add);
        expect(band.operations[3].date).toBeInstanceOf(Date);
        expect(band.operations[3].property).toEqual(expandIRI('foaf:member'));
        expect(band.operations[3].value).toBeInstanceOf(ModelKey);
        expect(toString(band.operations[3].value)).toEqual('https://berserk.fandom.com/wiki/Guts');

        expect(band.operations[4].resourceUrl).toEqual('solid://band-of-the-falcon#it');
        expect(band.operations[4].type).toEqual(SolidModelOperationType.Remove);
        expect(band.operations[4].date).toBeInstanceOf(Date);
        expect(band.operations[4].property).toEqual(expandIRI('foaf:member'));
        expect(band.operations[4].value).toHaveLength(3);
        [
            'https://berserk.fandom.com/wiki/Judeau',
            'https://berserk.fandom.com/wiki/Pippin',
            'https://berserk.fandom.com/wiki/Corkus',
        ].forEach((memberUrl, index) => {
            expect(band.operations[4].value[index]).toBeInstanceOf(ModelKey);
            expect(toString(band.operations[4].value[index])).toEqual(memberUrl);
        });

        // Assert - Griffith
        const griffith = band.creator as Person;
        expect(griffith).not.toBeNull();
        expect(griffith.name).toEqual('Femto');

        expect(griffith.metadata).not.toBeNull();
        expect(griffith.operations).toHaveLength(2);

        expect(griffith.metadata.resourceUrl).toEqual('solid://band-of-the-falcon#griffith');
        expect(griffith.metadata.createdAt).toBeInstanceOf(Date);
        expect(griffith.metadata.updatedAt).toBeInstanceOf(Date);

        expect(griffith.operations[0].resourceUrl).toEqual('solid://band-of-the-falcon#griffith');
        expect(griffith.operations[0].type).toBeUndefined();
        expect(griffith.operations[0].date).toBeInstanceOf(Date);
        expect(griffith.operations[0].property).toEqual(expandIRI('foaf:name'));
        expect(griffith.operations[0].value).toEqual('Griffith');

        expect(griffith.operations[1].resourceUrl).toEqual('solid://band-of-the-falcon#griffith');
        expect(griffith.operations[1].type).toBeUndefined();
        expect(griffith.operations[1].date).toBeInstanceOf(Date);
        expect(griffith.operations[1].property).toEqual(expandIRI('foaf:name'));
        expect(griffith.operations[1].value).toEqual('Femto');
    });

    it('synchronizes relations history in different models', async () => {
        // Arrange
        StubFetcher.addFetchResponse(fixture('mugiwara-1.ttl'));
        StubFetcher.addFetchResponse(fixture('mugiwara-1.ttl'));
        StubFetcher.addFetchResponse();

        StubFetcher.addFetchResponse(fixture('mugiwara-2.ttl'));
        StubFetcher.addFetchResponse();

        StubFetcher.addFetchResponse(fixture('mugiwara-3.ttl'));
        StubFetcher.addFetchResponse();

        // Act - Luffy becomes Straw Hat Luffy
        const mugiwara = await Group.find('solid://mugiwara#it') as Group;
        const luffy = mugiwara.members?.[0] as Person;

        luffy.givenName = 'Straw Hat Luffy';

        await mugiwara.save();

        // Act - Zoro joins
        const zoro = await mugiwara.relatedMembers.create({
            name: 'Roronoa Zoro',
            givenName: 'Pirate Hunter',
            age: 19,
        });

        // Act - Zoro and Luffy make their dreams come true
        luffy.givenName = 'The King of Pirates';
        zoro.givenName = 'The Greatest Swordsman';

        await mugiwara.save();

        // Assert
        expect(StubFetcher.fetch).toHaveBeenCalledTimes(7);

        expect(fetch.mock.calls[2][1]?.body).toEqualSparql(fixture('update-mugiwara-1.sparql'));
        expect(fetch.mock.calls[4][1]?.body).toEqualSparql(fixture('update-mugiwara-2.sparql'));
        expect(fetch.mock.calls[6][1]?.body).toEqualSparql(fixture('update-mugiwara-3.sparql'));
    });

});
