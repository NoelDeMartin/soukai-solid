import type { JsonLD } from '@noeldemartin/solid-utils';

import Recipe from '@/testing/lib/stubs/Recipe';
import { loadFixture } from '@/testing/utils';
import { InMemoryEngine, bootModels, setEngine } from 'soukai';
import RecipeInstructionsStep from '@/testing/lib/stubs/RecipeInstructionsStep';

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

});
