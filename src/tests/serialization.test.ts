import { FakeResponse, FakeServer } from '@noeldemartin/utils';
import type { JsonLD } from '@noeldemartin/solid-utils';

import { InMemoryEngine, bootModels, setEngine } from 'soukai';
import { SolidEngine } from '@/engines/SolidEngine';

import Recipe from '@/testing/lib/stubs/Recipe';
import RecipeInstructionsStep from '@/testing/lib/stubs/RecipeInstructionsStep';
import { loadFixture } from '@/testing/utils';

function expectRamen(ramen: Recipe) {
    expect(ramen.name).toEqual('Ramen');
    expect(ramen.instructionsSteps).toHaveLength(3);
}

describe('Serialization', () => {

    beforeEach(() => {
        setEngine(new InMemoryEngine);
        bootModels({ Recipe, RecipeInstructionsStep });
    });

    it('Imports from offline JSON-LD', async () => {
        // Arrange
        const jsonld = loadFixture<JsonLD>('recipes/ramen-offline.jsonld');

        // Act
        const ramen = await Recipe.createFromJsonLD(jsonld);

        // Assert
        expectRamen(ramen);
    });

    it('Imports from hosted JSON-LD', async () => {
        // Arrange
        const jsonld = loadFixture<JsonLD>('recipes/ramen-hosted.jsonld');

        // Act
        const ramen = await Recipe.createFromJsonLD(jsonld);

        // Assert
        expectRamen(ramen);
    });

    it('Maintains encoding', async () => {
        // Arrange - Prepare server
        const server = new FakeServer();

        server.respondOnce('https://pod.com/cookbook/ラーメン', FakeResponse.notFound());
        server.respondOnce('https://pod.com/cookbook/ラーメン', FakeResponse.success());

        setEngine(new SolidEngine(server.fetch));

        // Arrange - Create recipe and fake server url encoding
        const ramen = await Recipe.at('https://pod.com/cookbook/').create({
            url: 'https://pod.com/cookbook/ラーメン',
            name: 'ラーメン',
            instructionsStepUrls: ['https://pod.com/cookbook/垂れ'],
        });
        const turtle = await ramen.toTurtle();

        server.respondOnce(
            'https://pod.com/cookbook/ラーメン',
            FakeResponse.success(
                turtle.replaceAll(
                    'https://pod.com/cookbook/垂れ',
                    `https://pod.com/cookbook/${encodeURIComponent('垂れ')}`,
                ),
            ),
        );

        // Act
        const freshRamen = await ramen.fresh();

        // Assert
        expect(freshRamen.url).toEqual('https://pod.com/cookbook/ラーメン');
        expect(freshRamen.name).toEqual('ラーメン');
        expect(freshRamen.instructionsStepUrls[0]).toEqual('https://pod.com/cookbook/垂れ');
    });

});
