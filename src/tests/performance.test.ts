import { InMemoryEngine, bootModels, setEngine } from 'soukai';
import type { JsonLD } from '@noeldemartin/solid-utils';
import type { Relation } from 'soukai';

import { bootSolidModels } from '@/models';

import Recipe from '@/testing/lib/stubs/Recipe';
import RecipeInstructionsStep from '@/testing/lib/stubs/RecipeInstructionsStep';
import { loadFixture } from '@/testing/utils';

class RecipeInstructionsStepWithHistory extends RecipeInstructionsStep {

    public static timestamps = true;
    public static history = true;

}

class RecipeWithHistory extends Recipe {

    public static timestamps = true;
    public static history = true;

    public instructionsStepsRelationship(): Relation {
        return this
            .belongsToMany(RecipeInstructionsStepWithHistory, 'instructionsStepUrls')
            .usingSameDocument(true)
            .onDelete('cascade');
    }

}

describe('Performance', () => {

    beforeAll(() => {
        bootSolidModels();
        bootModels({ RecipeWithHistory, RecipeInstructionsStepWithHistory });
        setEngine(new InMemoryEngine);
    });

    testPerformance('Parses large documents quickly', { runs: 3, maxDuration: 5000 }, async () => {
        // Arrange
        const jsonld = loadFixture<JsonLD>('recipes/cookies.jsonld');

        // Act
        const cookies = await RecipeWithHistory.newFromJsonLD(jsonld);

        // Assert
        expect(cookies.name).toEqual('Vintage chocolate chip cookies!');
        expect(cookies.operations).toHaveLength(13);
        expect(cookies.instructionsSteps?.[0]?.operations).toHaveLength(58);
    });

});

interface PerformanceTestOptions {
    runs: number;
    maxDuration: number;
}

function testPerformance(name: string, options: PerformanceTestOptions, test: () => unknown | Promise<unknown>) {
    it(`${name} (${options.runs} runs, max ${options.maxDuration}ms)`, async () => {
        const times: number[] = [];

        for (let i = 0; i < options.runs; i++) {
            const start = Date.now();

            await test();

            times.push(Date.now() - start);
        }

        const averageTime = times.reduce((total, time) => total + time, 0) / times.length;

        expect(averageTime).toBeLessThan(options.maxDuration);
    });
}
