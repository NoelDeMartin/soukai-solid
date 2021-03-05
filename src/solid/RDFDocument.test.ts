import Faker from 'faker';

import RDFDocument from './RDFDocument';

describe('RDFDocument', () => {

    it('parses Turtle', async () => {
        // Arrange
        const url = Faker.internet.url();
        const name = Faker.name.firstName();

        // Act
        const document = await RDFDocument.fromTurtle(`
            @prefix foaf: <http://xmlns.com/foaf/0.1/> .

            <${url}>
                a foaf:Person ;
                foaf:name "${name}" .
        `, { baseUrl: url });

        // Assert
        expect(document.statements).toHaveLength(2);
        expect(document.url).toEqual(url);
        expect(document.resource(url)!.url).toEqual(url);
        expect(document.resource(url)!.isType('foaf:Person')).toBe(true);
        expect(document.resource(url)!.getPropertyValue('foaf:name')).toEqual(name);
    });

    it('parses JSON-LD', async () => {
        // Arrange
        const url = Faker.internet.url();
        const name = Faker.name.firstName();

        // Act
        const document = await RDFDocument.fromJsonLD({
            '@id': url,
            '@context': { '@vocab': 'http://xmlns.com/foaf/0.1/' },
            '@type': ['Person'],
            'name': name,
        });

        // Assert
        expect(document.statements).toHaveLength(2);
        expect(document.url).toEqual(url);
        expect(document.resource(url)!.url).toEqual(url);
        expect(document.resource(url)!.isType('foaf:Person')).toBe(true);
        expect(document.resource(url)!.getPropertyValue('foaf:name')).toEqual(name);
    });

});
