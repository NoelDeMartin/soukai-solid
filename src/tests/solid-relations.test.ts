import { bootModels, setEngine } from 'soukai';

import { SolidEngine } from '@/engines/SolidEngine';

import { loadFixture } from '@/testing/utils';
import Group from '@/testing/lib/stubs/Group';
import Person from '@/testing/lib/stubs/Person';
import StubFetcher from '@/testing/lib/stubs/StubFetcher';

const fixture = (name: string) => loadFixture(`solid-relations/${name}`);

describe('Solid Relations', () => {

    let fetch: jest.Mock<Promise<Response>, [RequestInfo, RequestInit?]>;

    beforeEach(() => {
        fetch = jest.fn((...args) => StubFetcher.fetch(...args));

        setEngine(new SolidEngine(fetch));
        bootModels({ Group, Person });
    });

    it('hasOne', async () => {
        // Arrange
        const group = new Group({
            url: 'https://onepiece.fandom.com/wiki/Straw_Hat_Pirates',
            name: 'Straw Hat Crew',
            creatorUrl: 'https://onepiece.fandom.com/wiki/Monkey_D._Luffy',
        });

        StubFetcher.addFetchResponse(fixture('luffy.ttl'));

        // Act
        await group.loadRelation('creator');

        // Assert
        const creator = group.creator as Person;

        expect(creator).not.toBeUndefined();
        expect(creator.url).toEqual('https://onepiece.fandom.com/wiki/Monkey_D._Luffy');
        expect(creator.name).toEqual('Luffy');

        expect(StubFetcher.fetch).toHaveBeenCalledTimes(1);
        expect(StubFetcher.fetch).toHaveBeenCalledWith(
            'https://onepiece.fandom.com/wiki/Monkey_D._Luffy',
            expect.anything(),
        );
    });

});
