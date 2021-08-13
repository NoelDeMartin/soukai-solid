import Faker from 'faker';
import { urlResolve } from '@noeldemartin/utils';
import type { JsonLD } from '@noeldemartin/solid-utils';

import flattenJsonLD from './flattenJsonLD';

describe('flattenJsonLD', () => {

    it('works', async () => {
        // Arrange
        const movieUrl = urlResolve(Faker.internet.url());
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
