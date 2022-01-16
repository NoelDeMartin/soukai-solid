import type { Relation } from 'soukai';

import type { SolidBelongsToManyRelation } from '@/models';

import Model from './Recipe.schema';
import RecipeInstructionsStep from './RecipeInstructionsStep';

export default class Recipe extends Model {

    public static rdfContexts = {
        schema: 'https://schema.org/',
    };

    public static rdfsClasses = ['schema:Recipe'];

    declare public instructionsSteps?: RecipeInstructionsStep[];
    declare public relatedInstructionsSteps: SolidBelongsToManyRelation<
        Recipe,
        RecipeInstructionsStep,
        typeof RecipeInstructionsStep
    >;

    public instructionsStepsRelationship(): Relation {
        return this
            .belongsToMany(RecipeInstructionsStep, 'instructionsStepUrls')
            .usingSameDocument(true)
            .onDelete('cascade');
    }

}
