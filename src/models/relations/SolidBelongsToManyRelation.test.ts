import { bootModels, setEngine } from 'soukai';
import { expandIRI } from '@noeldemartin/solid-utils';
import { stringToSlug, urlResolve } from '@noeldemartin/utils';
import Faker from 'faker';

import { stubPersonJsonLD } from '@/testing/lib/stubs/helpers';
import Person from '@/testing/lib/stubs/Person';
import StubEngine from '@/testing/lib/stubs/StubEngine';

let engine: StubEngine;

describe('SolidHasManyRelation', () => {

    beforeAll(() => bootModels({ Person }));
    beforeEach(() => setEngine(engine = new StubEngine()));

    it('uses document models for resolving models', async () => {
        // Arrange
        const firstContainerUrl = Faker.internet.url() + '/';
        const secondContainerUrl = Faker.internet.url() + '/';
        const firstDocumentUrl = urlResolve(firstContainerUrl, stringToSlug(Faker.random.word()));
        const secondDocumentUrl = urlResolve(secondContainerUrl, stringToSlug(Faker.random.word()));
        const thirdDocumentUrl = urlResolve(secondContainerUrl, stringToSlug(Faker.random.word()));
        const firstFriendUrl = firstDocumentUrl + '#it';
        const firstFriendName = Faker.random.word();
        const secondFriendUrl = secondDocumentUrl + '#it';
        const secondFriendName = Faker.random.word();
        const thirdFriendUrl = thirdDocumentUrl + '#it';
        const thirdFriendName = Faker.random.word();
        const person = new Person({
            name: Faker.random.word(),
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

        const friends = person.friends as Person[];
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
        expect(readSpy.mock.calls[0][1]).toEqual({
            $in: [firstDocumentUrl],
            ...personFilters,
        });
        expect(readSpy.mock.calls[1][1]).toEqual({
            $in: [secondDocumentUrl, thirdDocumentUrl],
            ...personFilters,
        });
    });

});
