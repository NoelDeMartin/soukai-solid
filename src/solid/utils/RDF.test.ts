import Faker from 'faker';

import Url from '@/utils/Url';

import RDF from './RDF';

describe('RDF helper', () => {

    it('parses Turtle', async () => {
        // Arrange
        const url = Faker.internet.url();
        const name = Faker.name.firstName();

        // Act
        const document = await RDF.parseTurtle(`
            @prefix foaf: <http://xmlns.com/foaf/0.1/> .

            <${url}>
                a foaf:Person ;
                foaf:name "${name}" .
        `, { baseUrl: url });

        // Assert
        expect(document.statements).toHaveLength(2);
        expect(document.url).toEqual(url);
        expect(document.rootResource.url).toEqual(url);
        expect(document.rootResource.isType('foaf:Person')).toBe(true);
        expect(document.rootResource.getPropertyValue('foaf:name')).toEqual(name);
    });

    it('parses JSON-LD', async () => {
        // Arrange
        const url = Faker.internet.url();
        const name = Faker.name.firstName();

        // Act
        const document = await RDF.parseJsonLD({
            '@id': url,
            '@context': { '@vocab': 'http://xmlns.com/foaf/0.1/' },
            '@type': ['Person'],
            'name': name,
        });

        // Assert
        expect(document.statements).toHaveLength(2);
        expect(document.url).toEqual(url);
        expect(document.rootResource.url).toEqual(url);
        expect(document.rootResource.isType('foaf:Person')).toBe(true);
        expect(document.rootResource.getPropertyValue('foaf:name')).toEqual(name);
    });

    it('flattens JSON-LD', async () => {
        // Arrange
        const movieUrl = Url.resolve(Faker.internet.url());
        const watchActionUrl = `${movieUrl}#${Faker.random.uuid()}`;
        const jsonld = {
            '@id': movieUrl,
            '@context': {
                '@vocab': 'https://schema.org/',
                'ldp': 'http://www.w3.org/ns/ldp#',
                'actions': { '@reverse': 'object' },
            },
            '@type': 'Movie',
            'name': name,
            'actions': [
                {
                    '@id': watchActionUrl,
                    '@context': { '@vocab': 'https://schema.org/' },
                    '@type': 'WatchAction',
                    'object': { '@id': movieUrl },
                },
            ],
        };

        // Act
        const flattened = await RDF.flattenJsonLD(jsonld);

        // Assert
        expect(flattened['@graph']).toHaveLength(2);

        const movie = flattened['@graph'].find(jsonld => jsonld['@id'] === movieUrl);
        expect(movie).not.toBeNull();
        movie['https://schema.org/name'] = name;

        const watchAction = flattened['@graph'].find(jsonld => jsonld['@id'] === watchActionUrl);
        expect(watchAction).not.toBeNull();
    });

    it('Gets jsonld properties', () => {
        // Arrange
        const jsonlds = [
            {
                'https://schema.org/name': 'Jackpot',
            },
            {
                '@context': {
                    '@vocab': 'https://schema.org/',
                },
                'name': 'Jackpot',
            },
            {
                '@context': {
                    'schema': 'https://schema.org/',
                },
                'schema:name': 'Jackpot',
            },
        ];

        // Act
        const results = jsonlds.map(jsonld => RDF.getJsonLDProperty(jsonld, 'https://schema.org/name'));

        // Assert
        results.forEach(result => expect(result).toEqual('Jackpot'));
    });

});
