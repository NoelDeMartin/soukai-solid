import { defineSolidModelSchema } from '@/main';
import { FieldType } from 'soukai';

export default defineSolidModelSchema({
    rdfsClass: 'schema:Action',
    rdfContexts: {
        tasks: 'https://vocab.noeldemartin.com/tasks/',
    },
    fields: {
        name: {
            type: FieldType.String,
            required: true,
        },
        description: FieldType.String,
        important: {
            rdfProperty: 'tasks:important',
            type: FieldType.Boolean,
        },
    },
});
