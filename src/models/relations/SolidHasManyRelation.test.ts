import Faker from 'faker';
import Soukai from 'soukai';
import { urlResolve, urlResolveDirectory } from '@noeldemartin/utils';

import IRI from '@/solid/utils/IRI';

import { stubMovieJsonLD, stubWatchActionJsonLD } from '@/testing/lib/stubs/helpers';
import Movie from '@/testing/lib/stubs/Movie';
import WatchAction from '@/testing/lib/stubs/WatchAction';
import StubEngine from '@/testing/lib/stubs/StubEngine';

let engine: StubEngine;

describe('SolidHasManyRelation', () => {

    beforeAll(() => Soukai.loadModels({ Movie, WatchAction }));

    beforeEach(() => {
        engine = new StubEngine();
        Soukai.useEngine(engine);
    });

    it('loads models from different containers', async () => {
        // Arrange
        const containerUrl = urlResolveDirectory(Faker.internet.url());
        const movieUrl = urlResolve(containerUrl, Faker.random.uuid());
        const firstActionUrl = `${movieUrl}#${Faker.random.uuid()}`;
        const secondActionUrl = urlResolve(containerUrl, Faker.random.uuid());

        engine.setOne({
            '@graph': [
                stubMovieJsonLD(movieUrl, Faker.lorem.word())['@graph'][0],
                stubWatchActionJsonLD(firstActionUrl, movieUrl, '1997-07-21T23:42:00.000Z')['@graph'][0],
                {
                    '@id': secondActionUrl,
                    [IRI('schema:object')]: { '@id': movieUrl },
                },
            ],
        });

        engine.setMany('solid://watchactions/', {
            [secondActionUrl]: stubWatchActionJsonLD(secondActionUrl, movieUrl, '2010-02-15T23:42:00.000Z'),
        });

        jest.spyOn(engine, 'readMany');

        // Act
        const movie = await Movie.find<Movie>(movieUrl);

        await movie!.loadRelation('actions');

        // Assert
        expect(movie!.actions).toHaveLength(2);

        expect(movie!.actions![0].url).toEqual(firstActionUrl);
        expect(movie!.actions![0].object).toEqual(movieUrl);
        expect(movie!.actions![0].startTime).toEqual(new Date('1997-07-21T23:42:00.000Z'));

        expect(movie!.actions![1].url).toEqual(secondActionUrl);
        expect(movie!.actions![1].object).toEqual(movieUrl);
        expect(movie!.actions![1].startTime).toEqual(new Date('2010-02-15T23:42:00.000Z'));

        expect(engine.readMany).toHaveBeenCalledWith(
            expect.anything(),
            {
                '$in': [
                    secondActionUrl,
                ],
                '@graph': {
                    $contains: {
                        '@type': {
                            $or: [
                                { $contains: ['WatchAction'] },
                                { $contains: [IRI('schema:WatchAction')] },
                                { $eq: 'WatchAction' },
                                { $eq: IRI('schema:WatchAction') },
                            ],
                        },
                    },
                },
            },
        );
    });

});
