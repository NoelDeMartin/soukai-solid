import { FieldType } from 'soukai';

import { defineSolidModelSchema } from '@/models/schema';

import PropertyOperation from './PropertyOperation';
import { propertyOperationFields } from './PropertyOperation.schema';

export default defineSolidModelSchema(PropertyOperation, {
    rdfsClass: 'AddPropertyOperation',
    fields: {
        ...propertyOperationFields,
        value: {
            type: FieldType.Any,
            required: true,
        },
    },
});
