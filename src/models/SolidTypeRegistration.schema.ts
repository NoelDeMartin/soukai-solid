import { FieldType } from 'soukai';

import { defineSolidModelSchema } from '@/models/schema';

export default defineSolidModelSchema({
    rdfContexts: { solid: 'http://www.w3.org/ns/solid/terms#' },
    rdfsClass: 'TypeRegistration',
    timestamps: false,
    fields: {
        forClass: {
            type: FieldType.Key,
            required: true,
        },
        instance: FieldType.Key,
        instanceContainer: FieldType.Key,
    },
});
