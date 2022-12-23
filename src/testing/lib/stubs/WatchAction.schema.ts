import { FieldType } from 'soukai';

import { defineSolidModelSchema } from '@/models/schema';

export default defineSolidModelSchema({
    rdfContexts: { schema: 'https://schema.org/' },
    rdfsClass: 'WatchAction',
    timestamps: false,
    fields: {
        object: FieldType.Key,
        startTime: FieldType.Date,
    },
});
