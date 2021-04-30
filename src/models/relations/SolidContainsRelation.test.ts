import Faker from 'faker';
import { bootModels, setEngine } from 'soukai';
import { urlResolveDirectory } from '@noeldemartin/utils';

import Group from '@/testing/lib/stubs/Group';
import Person from '@/testing/lib/stubs/Person';
import StubEngine from '@/testing/lib/stubs/StubEngine';

let engine: StubEngine;

describe('SolidHasManyRelation', () => {

    beforeAll(() => bootModels({ Group, Person }));

    beforeEach(() => {
        engine = new StubEngine();
        setEngine(engine);
    });

    it('creates related models', async () => {
        // Arrange
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

});
