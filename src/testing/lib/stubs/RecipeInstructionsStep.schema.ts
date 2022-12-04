import { FieldType } from 'soukai';

import { defineSolidModelSchema } from '@/models/schema';

export default defineSolidModelSchema({
    rdfContexts: {
        schema: 'https://schema.org/',
    },
    rdfsClasses: ['schema:HowToStep'],
    fields: {
        text: {
            type: FieldType.String,
            required: true,
        },
        position: {
            type: FieldType.Number,
            required: true,
        },
    },
});
