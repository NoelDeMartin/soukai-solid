import { bootModels } from 'soukai';

import Person from '@/testing/lib/stubs/Person';
import { SolidACLAuthorization } from '@/models';

describe('SolidACLAuthorizationsRelation', () => {

    beforeAll(() => bootModels({ Person }));

    it('is ignored for serialization', async () => {
        // Arrange
        const person = new Person({ name: 'John Doe' });

        person.relatedAuthorizations.addRelated(new SolidACLAuthorization());
        person.relatedAuthorizations.enable();

        // Act
        const jsonld = person.toJsonLD();

        // Assert
        expect(jsonld).toEqual({
            '@context': {
                '@vocab': 'http://xmlns.com/foaf/0.1/',
                'crdt': 'https://vocab.noeldemartin.com/crdt/',
                'metadata': { '@reverse': 'crdt:resource' },
            },
            '@type': 'Person',
            'name': 'John Doe',
            'metadata': { '@type': 'crdt:Metadata' },
        });
    });

});
