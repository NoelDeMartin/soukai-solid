import Faker from 'faker';

import RDF from '@/utils/RDF';

describe('RDF helper', () => {

    it('parses Turtle', async () => {
        // Arrange
        const url = Faker.internet.url();
        const name = Faker.name.firstName();

        // Act
        const resource = await RDF.parseTurtle(url, `
            @prefix foaf: <http://xmlns.com/foaf/0.1/> .

            <${url}>
                a foaf:Person ;
                foaf:name "${name}" .
        `);

        // Assert
        expect(resource.sourceStatements).toHaveLength(2);
        expect(resource.is('foaf:Person')).toBe(true);
        expect(resource.getPropertyValue('foaf:name')).toEqual(name);
    });

});
