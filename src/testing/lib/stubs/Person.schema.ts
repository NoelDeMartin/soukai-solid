import { defineSolidModelSchema } from '@/models/schema';
import { FieldType, TimestampField } from 'soukai';

export default defineSolidModelSchema({
    rdfContexts: { foaf: 'http://xmlns.com/foaf/0.1/' },
    rdfsClass: 'Person',
    timestamps: [TimestampField.CreatedAt],
    fields: {
        name: FieldType.String,
        lastName: FieldType.String,
        givenName: FieldType.String,
        age: FieldType.Number,
        directed: {
            type: FieldType.Key,
            rdfProperty: 'made',
        },
        starred: {
            type: FieldType.Array,
            rdfProperty: 'pastProject',
            items: FieldType.Key,
        },
        friendUrls: {
            type: FieldType.Array,
            rdfProperty: 'knows',
            items: FieldType.Key,
        },
    },
});
