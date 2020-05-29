import 'fake-indexeddb/auto';

import Faker from 'faker';
import Soukai from 'soukai';

import { IRI } from '@/solid/utils/RDF';
import Url from '@/utils/Url';

import Group from '@tests/stubs/Group';
import Person from '@tests/stubs/Person';
import StubEngine from '@tests/stubs/StubEngine';
import { stubPersonJsonLD, stubGroupJsonLD, stubSolidDocumentJsonLD } from '@tests/stubs/helpers';

let engine: StubEngine;

describe('SolidContainsRelation', () => {

    beforeAll(() => Soukai.loadModels({ Group, Person }));

    beforeEach(() => {
        engine = new StubEngine();
        Soukai.useEngine(engine);
    });

    it('caches models', async () => {
        // Arrange
        const groupUrl = Url.resolveDirectory(Faker.internet.url());
        const musashiUrl = Url.resolve(groupUrl, 'musashi');
        const kojiroUrl = Url.resolve(groupUrl, 'kojiro');
        const otsuUrl = Url.resolve(groupUrl, 'otsu');

        const loadGroupWithMembers = async () => {
            const group = await Group.find(groupUrl);

            await group!.loadRelation('members');

            return group!;
        }

        // Arrange - populate cache
        engine.setOne({
            '@graph': [
                stubGroupJsonLD(groupUrl, 'Main characters', [musashiUrl, kojiroUrl])['@graph'][0],
                stubSolidDocumentJsonLD(musashiUrl, '1997-07-21T23:42:00.000Z')['@graph'][0],
                stubSolidDocumentJsonLD(kojiroUrl, '1997-07-21T23:42:00.000Z')['@graph'][0],
            ],
        });
        engine.setMany(groupUrl, {
            [musashiUrl]: stubPersonJsonLD(musashiUrl, 'Musashi'),
            [kojiroUrl]: stubPersonJsonLD(kojiroUrl, 'Kojiro'),
        });

        await loadGroupWithMembers();

        // Arrange - prepare engine
        engine.setOne({
            '@graph': [
                stubGroupJsonLD(groupUrl, 'Main characters', [musashiUrl, kojiroUrl, otsuUrl])['@graph'][0],
                stubSolidDocumentJsonLD(musashiUrl, '1997-07-21T23:42:00.000Z')['@graph'][0],
                stubSolidDocumentJsonLD(kojiroUrl, '2010-02-15T23:42:00.000Z')['@graph'][0],
                stubSolidDocumentJsonLD(otsuUrl, '2010-02-15T23:42:00.000Z')['@graph'][0],
            ],
        });
        engine.setMany(groupUrl, {
            [kojiroUrl]: stubPersonJsonLD(kojiroUrl, 'Kojiro'),
            [otsuUrl]: stubPersonJsonLD(otsuUrl, 'Otsu'),
        });

        jest.spyOn(engine, 'readMany');

        // Act
        const group = await loadGroupWithMembers();

        // Assert
        expect(group.members).toHaveLength(3);

        expect(engine.readMany).toHaveBeenCalledTimes(1);
        expect(engine.readMany).toHaveBeenCalledWith(groupUrl, {
            $in: [kojiroUrl, otsuUrl],
            '@graph': {
                $contains: {
                    '@type': {
                        $or: [
                            { $contains: ['Person'] },
                            { $contains: [IRI('foaf:Person')] },
                            { $eq: 'Person' },
                            { $eq: IRI('foaf:Person') },
                        ],
                    },
                },
            },
        });
    });

});
