import { FieldType } from 'soukai';

import { defineSolidModelSchema } from '@/models/schema';

export default defineSolidModelSchema({
    rdfsClass: 'ldp:Container',
    timestamps: false,
    fields: {
        name: {
            type: FieldType.String,
            rdfProperty: 'rdfs:label',
        },
        resourceUrls: {
            type: FieldType.Array,
            rdfProperty: 'ldp:contains',
            items: FieldType.Key,
        },
    },
});
