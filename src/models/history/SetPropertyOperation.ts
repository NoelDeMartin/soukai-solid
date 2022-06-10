import { FieldType } from 'soukai';
import type { IModel } from 'soukai';

import type { SolidModel } from '@/models/SolidModel';

import PropertyOperation, { PropertyOperationFieldsDefinition } from './PropertyOperation';

export default class SetPropertyOperation extends PropertyOperation {

    public static rdfsClasses = ['SetPropertyOperation'];

    public static fields = {
        ...PropertyOperationFieldsDefinition,
        value: {
            type: FieldType.Any,
            required: true,
        },
    } as const;

    protected applyPropertyUpdate(model: SolidModel, field: string): void {
        model.setAttributeValue(field, this.value);
    }

}

export default interface SetPropertyOperation extends IModel<typeof SetPropertyOperation> {}
