import { arrayWithout, toString, urlParse } from '@noeldemartin/utils';
import { expandIRI as defaultExpandIRI } from '@noeldemartin/solid-utils';
import { InMemoryEngine, ModelKey, bootModels, setEngine } from 'soukai';
import type { Relation } from 'soukai';
import type { Tuple } from '@noeldemartin/utils';

import IRI from '@/solid/utils/IRI';
import { SolidEngine } from '@/engines';
import {
    AddPropertyOperation,
    PropertyOperation,
    RemovePropertyOperation,
    SetPropertyOperation,
    SolidModel,
} from '@/models';
import type { SolidBelongsToManyRelation } from '@/models';

import BaseGroup from '@/testing/lib/stubs/Group';
import BasePerson from '@/testing/lib/stubs/Person';
import StubFetcher from '@/testing/lib/stubs/StubFetcher';
import { assertInstanceOf, loadFixture } from '@/testing/utils';

const expandIRI = (iri: string) => defaultExpandIRI(iri, {
    extraContext: {
        crdt: 'https://vocab.noeldemartin.com/crdt/',
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

    declare public relatedMembers: SolidBelongsToManyRelation<Group, Person, typeof Person>;
    declare public members?: Person[];

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

const fixture = <T=string>(name: string) => loadFixture<T>(`solid-history/${name}`);

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
        expect(fetch.mock.calls[1]?.[1]?.body).toEqualSparql(fixture('create-griffith.sparql'));
        expect(fetch.mock.calls[3]?.[1]?.body).toEqualSparql(fixture('update-griffith-1.sparql'));
        expect(fetch.mock.calls[5]?.[1]?.body).toEqualSparql(fixture('update-griffith-2.sparql'));
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

        const griffith = band.relatedCreator.attach({ name: 'Griffith' });

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

        expect(fetch.mock.calls[1]?.[1]?.body).toEqualSparql(fixture('create-band-of-the-falcon.sparql'));
        expect(fetch.mock.calls[3]?.[1]?.body).toEqualSparql(fixture('update-band-of-the-falcon-1.sparql'));
        expect(fetch.mock.calls[5]?.[1]?.body).toEqualSparql(fixture('update-band-of-the-falcon-2.sparql'));
        expect(fetch.mock.calls[7]?.[1]?.body).toEqualSparql(fixture('update-band-of-the-falcon-3.sparql'));
    });

    it('Reads operation values with explicit types', async () => {
        // Arrange
        StubFetcher.addFetchResponse(fixture('band-of-the-falcon-3.ttl'));

        // Act
        const band = await Group.find('solid://band-of-the-falcon#it') as Group;

        // Assert - Band
        const bandOperations = band.operations as Tuple<PropertyOperation, 5>;
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

        assertInstanceOf(bandOperations[0], SetPropertyOperation, operation => {
            expect(operation.resourceUrl).toEqual('solid://band-of-the-falcon#it');
            expect(operation.date).toBeInstanceOf(Date);
            expect(operation.property).toEqual(expandIRI('foaf:name'));
            expect(operation.value).toEqual('Band of the Falcon');
        });

        assertInstanceOf(bandOperations[1], SetPropertyOperation, operation => {
            expect(operation.resourceUrl).toEqual('solid://band-of-the-falcon#it');
            expect(operation.date).toBeInstanceOf(Date);
            expect(operation.property).toEqual(expandIRI('foaf:member'));
            expect(operation.value).toHaveLength(5);
            [
                'https://berserk.fandom.com/wiki/Griffith',
                'https://berserk.fandom.com/wiki/Casca',
                'https://berserk.fandom.com/wiki/Judeau',
                'https://berserk.fandom.com/wiki/Pippin',
                'https://berserk.fandom.com/wiki/Corkus',
            ].forEach((memberUrl, index) => {
                expect(operation.value[index]).toBeInstanceOf(ModelKey);
                expect(toString(operation.value[index])).toEqual(memberUrl);
            });
        });

        assertInstanceOf(bandOperations[2], SetPropertyOperation, operation => {
            expect(operation.resourceUrl).toEqual('solid://band-of-the-falcon#it');
            expect(operation.date).toBeInstanceOf(Date);
            expect(operation.property).toEqual(expandIRI('foaf:maker'));
            expect(operation.value).toBeInstanceOf(ModelKey);
            expect(toString(operation.value)).toEqual('solid://band-of-the-falcon#griffith');
        });

        assertInstanceOf(bandOperations[3], AddPropertyOperation, operation => {
            expect(operation.resourceUrl).toEqual('solid://band-of-the-falcon#it');
            expect(operation.date).toBeInstanceOf(Date);
            expect(operation.property).toEqual(expandIRI('foaf:member'));
            expect(operation.value).toBeInstanceOf(ModelKey);
            expect(toString(operation.value)).toEqual('https://berserk.fandom.com/wiki/Guts');
        });

        assertInstanceOf(bandOperations[4], RemovePropertyOperation, operation => {
            expect(operation.resourceUrl).toEqual('solid://band-of-the-falcon#it');
            expect(operation.date).toBeInstanceOf(Date);
            expect(operation.property).toEqual(expandIRI('foaf:member'));
            expect(operation.value).toHaveLength(3);
            [
                'https://berserk.fandom.com/wiki/Judeau',
                'https://berserk.fandom.com/wiki/Pippin',
                'https://berserk.fandom.com/wiki/Corkus',
            ].forEach((memberUrl, index) => {
                expect(operation.value[index]).toBeInstanceOf(ModelKey);
                expect(toString(operation.value[index])).toEqual(memberUrl);
            });
        });

        // Assert - Griffith
        const griffith = band.creator as Person;
        const griffithOperations = griffith.operations as Tuple<PropertyOperation, 2>;
        expect(griffith).not.toBeNull();
        expect(griffith.name).toEqual('Femto');

        expect(griffith.metadata).not.toBeNull();
        expect(griffith.operations).toHaveLength(2);

        expect(griffith.metadata.resourceUrl).toEqual('solid://band-of-the-falcon#griffith');
        expect(griffith.metadata.createdAt).toBeInstanceOf(Date);
        expect(griffith.metadata.updatedAt).toBeInstanceOf(Date);

        assertInstanceOf(griffithOperations[0], SetPropertyOperation, operation => {
            expect(operation.resourceUrl).toEqual('solid://band-of-the-falcon#griffith');
            expect(operation.date).toBeInstanceOf(Date);
            expect(operation.property).toEqual(expandIRI('foaf:name'));
            expect(operation.value).toEqual('Griffith');
        });

        assertInstanceOf(griffithOperations[1], SetPropertyOperation, operation => {
            expect(operation.resourceUrl).toEqual('solid://band-of-the-falcon#griffith');
            expect(operation.date).toBeInstanceOf(Date);
            expect(operation.property).toEqual(expandIRI('foaf:name'));
            expect(operation.value).toEqual('Femto');
        });
    });

    it('Synchronizes relations history in different models', async () => {
        // Arrange
        StubFetcher.addFetchResponse(fixture('mugiwara-1.ttl'));
        StubFetcher.addFetchResponse(fixture('mugiwara-1.ttl'));
        StubFetcher.addFetchResponse();

        StubFetcher.addFetchResponse(fixture('mugiwara-2.ttl'));
        StubFetcher.addFetchResponse();

        StubFetcher.addFetchResponse(fixture('mugiwara-3.ttl'));
        StubFetcher.addFetchResponse();

        // Act - Luffy becomes Straw Hat Luffy
        const mugiwara = await Group.find('solid://bands/mugiwara#it') as Group;
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

        expect(fetch.mock.calls[2]?.[1]?.body).toEqualSparql(fixture('update-mugiwara-1.sparql'));
        expect(fetch.mock.calls[4]?.[1]?.body).toEqualSparql(fixture('update-mugiwara-2.sparql'));
        expect(fetch.mock.calls[6]?.[1]?.body).toEqualSparql(fixture('update-mugiwara-3.sparql'));
    });

    it('Synchronizes models with related models', async () => {
        // -------------- Part I --------------

        // Arrange - prepare network stubs
        StubFetcher.addFetchResponse(fixture('mugiwara-2.ttl'));
        StubFetcher.addFetchResponse(fixture('mugiwara-2.ttl'));
        StubFetcher.addFetchResponse();

        // Arrange - prepare models
        const localEngine = new InMemoryEngine();

        class LocalGroup extends Group {

            public creatorRelationship(): Relation {
                return this
                    .belongsToOne(LocalPerson, 'creatorUrl')
                    .usingSameDocument(true)
                    .onDelete('cascade');
            }

            public membersRelationship(): Relation {
                return this
                    .belongsToMany(LocalPerson, 'memberUrls')
                    .usingSameDocument(true);
            }

        }

        class LocalPerson extends Person {}

        bootModels({ LocalGroup, LocalPerson });

        LocalGroup.setEngine(localEngine);
        LocalPerson.setEngine(localEngine);

        const remoteMugiwara = await Group.find('solid://bands/mugiwara#it') as Group;
        const localMugiwara = remoteMugiwara.clone({
            constructors: [
                [Group, LocalGroup],
                [Person, LocalPerson],
            ],
        });

        await localMugiwara.save();

        // Arrange - add member
        await remoteMugiwara.relatedMembers.create({
            name: 'Roronoa Zoro',
            givenName: 'Pirate Hunter',
            age: 19,
        });

        const nami = await localMugiwara.relatedMembers.create({ name: 'Nami' });

        const inceptionRemoteOperationUrls = remoteMugiwara.operations.slice(0, 2).map(operation => operation.url);

        // Arrange - prepare network stubs
        StubFetcher.addFetchResponse(
            fixture('mugiwara-3.ttl')
                .replace(/it-operation-1/g, urlParse(remoteMugiwara.operations[0]?.url ?? '')?.fragment ?? '')
                .replace(/it-operation-2/g, urlParse(remoteMugiwara.operations[1]?.url ?? '')?.fragment ?? ''),
        );
        StubFetcher.addFetchResponse();

        // Act
        await SolidModel.synchronize(localMugiwara, remoteMugiwara);
        await localMugiwara.save();
        await remoteMugiwara.save();

        // Assert
        [localMugiwara, remoteMugiwara].forEach(model => {
            expect(model.isDirty()).toBe(false);
            expect(model.members).toHaveLength(3);
            expect(model.memberUrls).toHaveLength(3);
        });

        let localHistoryHash = localMugiwara.getHistoryHash();
        expect(localHistoryHash).not.toBeNull();
        expect(localHistoryHash).toEqual(remoteMugiwara.getHistoryHash());

        expect(StubFetcher.fetch).toHaveBeenCalledTimes(5);

        const getUpdateVersion = () => {
            const [firstRegeneratedOperation, ...regeneratedOperations] = remoteMugiwara
                .operations
                .slice(0, 2)
                .filter(operation => !inceptionRemoteOperationUrls.includes(operation.url));

            if (!firstRegeneratedOperation)
                return 'v1';

            if (regeneratedOperations.length === 1)
                return 'v4';

            const property = firstRegeneratedOperation instanceof PropertyOperation
                && firstRegeneratedOperation.property;

            return property === IRI('foaf:member') ? 'v2' : 'v3';
        };

        expect(fetch.mock.calls[4]?.[1]?.body).toEqualSparql(fixture(`update-mugiwara-4-${getUpdateVersion()}.sparql`));

        await expect(remoteMugiwara.toJsonLD()).toEqualJsonLD(fixture('mugiwara-4.jsonld'));
        await expect(localMugiwara.toJsonLD()).toEqualJsonLD(fixture('mugiwara-4.jsonld'));
        await expect(localEngine.database['solid://bands/']?.['solid://bands/mugiwara'])
            .toEqualJsonLD(fixture('mugiwara-4.jsonld'));

        // -------------- Part II --------------

        // Arrange - update member
        StubFetcher.addFetchResponse(fixture('mugiwara-4.ttl'));
        StubFetcher.addFetchResponse();

        await nami.update({ givenName: 'Cat Burglar' });

        // Act
        await SolidModel.synchronize(localMugiwara, remoteMugiwara);
        await localMugiwara.save();
        await remoteMugiwara.save();

        // Assert
        expect(localMugiwara.getHistoryHash()).not.toEqual(localHistoryHash);

        localHistoryHash = localMugiwara.getHistoryHash();
        expect(localHistoryHash).not.toBeNull();
        expect(localHistoryHash).toEqual(remoteMugiwara.getHistoryHash());

        expect(StubFetcher.fetch).toHaveBeenCalledTimes(7);

        expect(fetch.mock.calls[6]?.[1]?.body).toEqualSparql(fixture('update-mugiwara-5.sparql'));

        await expect(remoteMugiwara.toJsonLD()).toEqualJsonLD(fixture('mugiwara-5.jsonld'));
        await expect(localMugiwara.toJsonLD()).toEqualJsonLD(fixture('mugiwara-5.jsonld'));
        await expect(localEngine.database['solid://bands/']?.['solid://bands/mugiwara'])
            .toEqualJsonLD(fixture('mugiwara-5.jsonld'));

        // -------------- Part III --------------

        // Arrange - remove member
        StubFetcher.addFetchResponse(fixture('mugiwara-5.ttl'));
        StubFetcher.addFetchResponse();

        await localMugiwara.relatedMembers.remove(nami);

        // Act
        await SolidModel.synchronize(localMugiwara, remoteMugiwara);
        await localMugiwara.save();
        await remoteMugiwara.save();

        // Assert
        expect(localMugiwara.getHistoryHash()).not.toEqual(localHistoryHash);

        localHistoryHash = localMugiwara.getHistoryHash();
        expect(localHistoryHash).not.toBeNull();
        expect(localHistoryHash).toEqual(remoteMugiwara.getHistoryHash());

        expect(StubFetcher.fetch).toHaveBeenCalledTimes(9);

        expect(fetch.mock.calls[8]?.[1]?.body).toEqualSparql(fixture('update-mugiwara-6.sparql'));

        await expect(remoteMugiwara.toJsonLD()).toEqualJsonLD(fixture('mugiwara-6.jsonld'));
        await expect(localMugiwara.toJsonLD()).toEqualJsonLD(fixture('mugiwara-6.jsonld'));
        await expect(localEngine.database['solid://bands/']?.['solid://bands/mugiwara'])
            .toEqualJsonLD(fixture('mugiwara-6-document.jsonld'));
    });

    it('Leaves a Tombstone behind', async () => {
        // Arrange
        const bandTurtle = fixture('band-of-the-falcon-3.ttl');

        StubFetcher.addFetchResponse(bandTurtle);

        // TODO this could be improved to fetch only once
        StubFetcher.addFetchResponse(bandTurtle); // Fetch document to see if it can be deleted entirely
        StubFetcher.addFetchResponse(bandTurtle);// Fetch document under SolidClient.update to prepare PATCH
        StubFetcher.addFetchResponse(); // PATCH document

        const band = await Group.find('solid://band-of-the-falcon#it') as Group;

        // Act
        await band.delete();

        // Arrange
        expect(band.exists()).toBe(false);

        expect(StubFetcher.fetch).toHaveBeenCalledTimes(4);

        expect(fetch.mock.calls[3]?.[1]?.method).toEqual('PATCH');
        expect(fetch.mock.calls[3]?.[1]?.body).toEqualSparql(`
            DELETE DATA { ${bandTurtle} } ;
            INSERT DATA {
                @prefix crdt: <https://vocab.noeldemartin.com/crdt/> .
                @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

                <#it-metadata>
                    a crdt:Tombstone ;
                    crdt:resource <#it> ;
                    crdt:deletedAt  "[[.*]]"^^xsd:dateTime .
            } .
        `);
    });

});
