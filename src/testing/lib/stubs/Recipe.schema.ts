import { FieldType } from 'soukai';

import { SolidModel } from '@/models';

export default SolidModel.schema({
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
});
