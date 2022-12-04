import { FieldType } from 'soukai';

import type { ISolidModel, SolidModel } from '@/models/SolidModel';

import Operation, { OperationFieldsDefinition } from './Operation';

export const PropertyOperationFieldsDefinition = {
    ...OperationFieldsDefinition,
    property: {
        type: FieldType.Key,
        required: true,
    },
} as const;

export default class PropertyOperation extends Operation {

    public static rdfsClasses = ['PropertyOperation'];

    public static fields = PropertyOperationFieldsDefinition;

    public apply(model: SolidModel): void {
        const field = model.static().getRdfPropertyField(this.property);

        if (!field) {
            return;
        }

        this.applyPropertyUpdate(model, field);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected applyPropertyUpdate(model: SolidModel, field: string): void {
        //
    }

}

export default interface PropertyOperation extends ISolidModel<typeof PropertyOperation> {}
