import Faker from 'faker';

import Soukai from 'soukai';

import Url from '@/utils/Url';

import { stubWatchActionJsonLD } from '@tests/stubs/helpers';
import Movie from '@tests/stubs/Movie';
import StubEngine from '@tests/stubs/StubEngine';
import WatchAction from '@tests/stubs/WatchAction';

let engine: StubEngine;

describe('SolidEmbedsRelation', () => {

    beforeAll(() => {
        Soukai.loadModel('Movie', Movie);
        Soukai.loadModel('WatchAction', WatchAction);
    });

    beforeEach(() => {
        engine = new StubEngine();
        Soukai.useEngine(engine);
    });

    it('creates embeded models', async () => {
        const movieUrl = Url.resolve(Faker.internet.url());

        const movie = new Movie({url: movieUrl});

        jest.spyOn(engine, 'create');

        const action = await movie.actionsRelationship().create({ object: movieUrl });

        expect(action).not.toBeNull();
        expect(action.url.startsWith(movieUrl + '#')).toBeTruthy();
        expect(action.object).toEqual(movieUrl);

        expect(engine.create).toHaveBeenCalledTimes(1);
        expect(engine.create).toHaveBeenCalledWith(
            movieUrl,
            stubWatchActionJsonLD(action.url, movieUrl),
            action.url,
        );
    });
});
