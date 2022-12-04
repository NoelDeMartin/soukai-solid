import { FieldType } from 'soukai';

import { defineSolidModelSchema } from '@/models/schema';

export default defineSolidModelSchema({
    rdfContexts: {
        schema: 'https://schema.org/',
    },
    rdfsClasses: ['Recipe'],
    fields: {
        name: {
            type: FieldType.String,
            required: true,
        },
        ingredients: {
            type: FieldType.Array,
            rdfProperty: 'schema:recipeIngredient',
            items: FieldType.String,
        },
        instructionsStepUrls: {
            type: FieldType.Array,
            rdfProperty: 'schema:recipeInstructions',
            items: FieldType.Key,
        },
    },
});
