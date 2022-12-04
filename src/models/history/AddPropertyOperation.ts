import { arrayFrom } from '@noeldemartin/utils';
import { FieldType, SoukaiError } from 'soukai';

import type { ISolidModel, SolidModel } from '@/models/SolidModel';

import PropertyOperation, { PropertyOperationFieldsDefinition } from './PropertyOperation';

export default class AddPropertyOperation extends PropertyOperation {

    public static rdfsClasses = ['AddPropertyOperation'];

    public static fields = {
        ...PropertyOperationFieldsDefinition,
        value: {
            type: FieldType.Any,
            required: true,
        },
    } as const;

    protected applyPropertyUpdate(model: SolidModel, field: string): void {
        const value = model.getAttributeValue(field);

        if (!Array.isArray(value)) {
            throw new SoukaiError('Can\'t apply Add operation to non-array field (should be Set instead)');
        }

        model.setAttributeValue(field, [...value, ...arrayFrom(this.value)]);
    }

}

export default interface AddPropertyOperation extends ISolidModel<typeof AddPropertyOperation> {}
