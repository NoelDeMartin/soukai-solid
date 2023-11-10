import { fakeDocumentUrl } from '@noeldemartin/solid-utils';
import { setEngine } from 'soukai';

import { SolidEngine } from '@/engines/SolidEngine';

import StubFetcher from '@/testing/lib/stubs/StubFetcher';

import SolidTypeIndex from './SolidTypeIndex';

describe('SolidTypeIndex', () => {

    let fetch: jest.Mock<Promise<Response>, [RequestInfo, RequestInit?]>;

    beforeEach(() => {
        fetch = jest.fn((...args) => StubFetcher.fetch(...args));

        setEngine(new SolidEngine(fetch));
    });

    it('reads type registrations', async () => {
        // Arrange
        const typeIndexUrl = fakeDocumentUrl();

        StubFetcher.addFetchResponse(`
            @prefix solid: <http://www.w3.org/ns/solid/terms#> .
            @prefix schema: <https://schema.org/> .

            <>
                a solid:TypeIndex ;
                a solid:ListedDocument.

            <#movies> a solid:TypeRegistration;
                solid:forClass schema:Movie;
                solid:instanceContainer </movies>.

            <#recipes> a solid:TypeRegistration;
                solid:forClass schema:Recipe;
                solid:instanceContainer </recipes>.

            <#spirited-away> a solid:TypeRegistration;
                solid:forClass schema:Movie;
                solid:instance </movies/spirited-away>.

            <#ramen> a solid:TypeRegistration;
                solid:forClass schema:Recipe;
                solid:instance </recipes/ramen>.
        `);

        // Act
        const typeIndex = await SolidTypeIndex.find(typeIndexUrl);

        // Assert
        expect(fetch).toHaveBeenCalledTimes(1);

        expect(typeIndex).not.toBeNull();
        expect(typeIndex?.registrations).toHaveLength(4);
    });


});
