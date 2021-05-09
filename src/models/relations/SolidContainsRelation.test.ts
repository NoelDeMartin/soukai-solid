import Faker from 'faker';
import { InMemoryEngine, bootModels, setEngine } from 'soukai';
import { urlResolveDirectory } from '@noeldemartin/utils';

import Group from '@/testing/lib/stubs/Group';
import Person from '@/testing/lib/stubs/Person';
import StubEngine from '@/testing/lib/stubs/StubEngine';

describe('SolidContainsRelation', () => {

    beforeAll(() => bootModels({ Group, Person }));

    it('creates related models for solid engines', async () => {
        // Arrange
        setEngine(new StubEngine());

        const containerUrl = urlResolveDirectory(Faker.internet.url());
        const personName = Faker.name.title();
        const group = new Group({ url: containerUrl }, true);

        group.relatedMembers.related = [];

        // Act
        const person = await group.relatedMembers.create({ name: personName });

        // Assert
        expect(group.resourceUrls).toHaveLength(1);
        expect(group.members).toHaveLength(1);
        expect(group.resourceUrls[0]).toEqual(person.getDocumentUrl());
        expect(group.members?.[0]).toEqual(person);
        expect(person.exists()).toBe(true);
        expect(person.url.startsWith(group.url)).toBe(true);
        expect(person.name).toEqual(personName);
    });

    it('creates related models for non-solid engines', async () => {
        // Arrange
        setEngine(new InMemoryEngine());

        const containerUrl = urlResolveDirectory(Faker.internet.url());
        const personName = Faker.name.title();
        const group = await Group.create({ url: containerUrl });

        // Act
        const person = await group.relatedMembers.create({ name: personName });

        // Assert
        expect(group.resourceUrls).toHaveLength(1);
        expect(group.members).toHaveLength(1);
        expect(group.resourceUrls[0]).toEqual(person.getDocumentUrl());
        expect(group.members?.[0]).toEqual(person);
        expect(person.exists()).toBe(true);
        expect(person.url.startsWith(group.url)).toBe(true);
        expect(person.name).toEqual(personName);
    });

});
