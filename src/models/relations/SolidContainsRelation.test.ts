import Faker from 'faker';
import Soukai from 'soukai';

import Url from '@/utils/Url';

import Group from '@tests/stubs/Group';
import Person from '@tests/stubs/Person';
import StubEngine from '@tests/stubs/StubEngine';

let engine: StubEngine;

describe('SolidHasManyRelation', () => {

    beforeAll(() => {Soukai.loadModels({ Group, Person })});

    beforeEach(() => {
        engine = new StubEngine();
        Soukai.useEngine(engine);
    });

    it('creates related models', async () => {
        // Arrange
        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const personName = Faker.name.title();
        const group = new Group({ url: containerUrl }, true);

        group.relatedMembers.related = [];

        // Act
        const person = await group.relatedMembers.create({ name: personName });

        // Assert
        expect(group.resourceUrls).toHaveLength(1);
        expect(group.members).toHaveLength(1);
        expect(group.resourceUrls[0]).toEqual(person.getDocumentUrl());
        expect(group.members![0]).toEqual(person);
        expect(person.exists()).toBe(true);
        expect(person.url.startsWith(group.url)).toBe(true);
        expect(person.name).toEqual(personName);
    });

});
