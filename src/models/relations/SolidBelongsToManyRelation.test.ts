import { faker } from '@noeldemartin/faker';
import { bootModels, setEngine } from 'soukai';
import { expandIRI } from '@noeldemartin/solid-utils';
import { stringToSlug, urlResolve } from '@noeldemartin/utils';
import type { Relation } from 'soukai';
import type { Tuple } from '@noeldemartin/utils';

import { SolidModel } from '@/models/SolidModel';

import Person from '@/testing/lib/stubs/Person';
import StubEngine from '@/testing/lib/stubs/StubEngine';
import { stubPersonJsonLD } from '@/testing/lib/stubs/helpers';

let engine: StubEngine;

class PersonWithHistory extends Person {

    public static timestamps = true;
    public static history = true;

    public friendsRelationship(): Relation {
        return this
            .belongsToMany(Person, 'friendUrls')
            .usingSameDocument(true)
            .onDelete('cascade');
    }

}

describe('SolidHasManyRelation', () => {

    beforeAll(() => bootModels({ Person, PersonWithHistory }));
    beforeEach(() => setEngine(engine = new StubEngine()));

    it('uses document models for resolving models', async () => {
        // Arrange
        const firstContainerUrl = faker.internet.url() + '/';
        const secondContainerUrl = faker.internet.url() + '/';
        const firstDocumentUrl = urlResolve(firstContainerUrl, stringToSlug(faker.random.word()));
        const secondDocumentUrl = urlResolve(secondContainerUrl, stringToSlug(faker.random.word()));
        const thirdDocumentUrl = urlResolve(secondContainerUrl, stringToSlug(faker.random.word()));
        const firstFriendUrl = firstDocumentUrl + '#it';
        const firstFriendName = faker.random.word();
        const secondFriendUrl = secondDocumentUrl + '#it';
        const secondFriendName = faker.random.word();
        const thirdFriendUrl = thirdDocumentUrl + '#it';
        const thirdFriendName = faker.random.word();
        const person = new Person({
            name: faker.random.word(),
            friendUrls: [
                firstFriendUrl,
                secondFriendUrl,
                thirdFriendUrl,
            ],
        }, true);

        engine.setMany(firstContainerUrl, {
            [firstDocumentUrl]: stubPersonJsonLD(firstFriendUrl, firstFriendName),
        });

        engine.setMany(secondContainerUrl, {
            [secondDocumentUrl]: stubPersonJsonLD(secondFriendUrl, secondFriendName),
            [thirdDocumentUrl]: stubPersonJsonLD(thirdFriendUrl, thirdFriendName),
        });

        const readSpy = jest.spyOn(engine, 'readMany');

        // Act
        await person.loadRelation('friends');

        // Assert
        expect(person.friends).toHaveLength(3);

        const friends = person.friends as Tuple<Person, 3>;
        expect(friends[0].url).toEqual(firstFriendUrl);
        expect(friends[0].name).toEqual(firstFriendName);
        expect(friends[1].url).toEqual(secondFriendUrl);
        expect(friends[1].name).toEqual(secondFriendName);
        expect(friends[2].url).toEqual(thirdFriendUrl);
        expect(friends[2].name).toEqual(thirdFriendName);

        expect(engine.readMany).toHaveBeenCalledTimes(2);

        const personFilters = {
            '@graph': {
                $contains: {
                    '@type': {
                        $or: [
                            { $contains: ['Person'] },
                            { $contains: [expandIRI('foaf:Person')] },
                            { $eq: 'Person' },
                            { $eq: expandIRI('foaf:Person') },
                        ],
                    },
                },
            },
        };
        expect(readSpy.mock.calls[0]?.[1]).toEqual({
            $in: [firstDocumentUrl],
            ...personFilters,
        });
        expect(readSpy.mock.calls[1]?.[1]).toEqual({
            $in: [secondDocumentUrl, thirdDocumentUrl],
            ...personFilters,
        });
    });

    it('synchronizes from different operations', async () => {
        // Arrange
        const source = await PersonWithHistory.create({ name: 'Luffy' });
        const target = source.clone({ clean: true });

        // Act
        await source.relatedFriends.create({ name: 'Zoro' });

        source.relatedFriends.attach({ name: 'Nami' });
        source.relatedFriends.attach({ name: 'Usopp' });

        await source.save();
        await SolidModel.synchronize(source, target);

        // Assert
        expect(target.friends).toHaveLength(3);

        expect(target.friends?.[0]?.name).toEqual('Zoro');
        expect(target.friends?.[1]?.name).toEqual('Nami');
        expect(target.friends?.[2]?.name).toEqual('Usopp');
    });

});
