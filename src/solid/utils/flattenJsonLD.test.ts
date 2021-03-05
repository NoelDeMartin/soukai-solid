import Faker from 'faker';

import Url from '@/utils/Url';
import type { JsonLD } from '@/solid/utils/RDF';

import flattenJsonLD from './flattenJsonLD';

describe('flattenJsonLD', () => {

    it('works', async () => {
        // Arrange
        const movieUrl = Url.resolve(Faker.internet.url());
        const watchActionUrl = `${movieUrl}#${Faker.random.uuid()}`;
        const jsonld: JsonLD = {
            '@id': movieUrl,
            '@context': {
                '@vocab': 'https://schema.org/',
                'ldp': 'http://www.w3.org/ns/ldp#',
                'actions': { '@reverse': 'object' },
            },
            '@type': 'Movie',
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
        const flattened = await flattenJsonLD(jsonld);

        // Assert
        expect(flattened['@graph']).toHaveLength(2);

        const movie = flattened['@graph'].find(jsonld => jsonld['@id'] === movieUrl);
        expect(movie).not.toBeNull();

        const watchAction = flattened['@graph'].find(jsonld => jsonld['@id'] === watchActionUrl);
        expect(watchAction).not.toBeNull();
    });

});