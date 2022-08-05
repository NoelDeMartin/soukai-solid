import { arrayFrom, arrayWithout, tap } from '@noeldemartin/utils';
import { FieldType, SoukaiError } from 'soukai';
import type { BootedFieldDefinition , IModel } from 'soukai';

import type { SolidModel } from '@/models/SolidModel';
import type { SolidModelConstructor } from '@/models/inference';

import PropertyOperation, { PropertyOperationFieldsDefinition } from './PropertyOperation';

type AttributeCaster = <T>(field: string, value: T) => T;

export default class RemovePropertyOperation extends PropertyOperation {

    public static rdfsClasses = ['RemovePropertyOperation'];

    public static fields = {
        ...PropertyOperationFieldsDefinition,
        value: {
            type: FieldType.Any,
            required: true,
        },
    } as const;

    private static attributeCasters: WeakMap<typeof SolidModel, AttributeCaster> = new WeakMap;

    protected applyPropertyUpdate(model: SolidModel, field: string): void {
        const value = model.getAttributeValue(field);

        if (!Array.isArray(value)) {
            throw new SoukaiError('Can\'t apply Remove operation to non-array field (use Unset instead)');
        }

        model.setAttributeValue(
            field,
            arrayWithout(value, this.castModelAttribute(model, field, arrayFrom(this.value))),
        );
    }

    private castModelAttribute<T = unknown>(model: SolidModel, field: string, value: T): T {
        const ModelClass = model.constructor as SolidModelConstructor;
        const caster = RemovePropertyOperation.attributeCasters.get(ModelClass)
            ?? this.createAttributeCaster(ModelClass);

        return caster(field, value);
    }

    private createAttributeCaster(ModelClass: SolidModelConstructor): AttributeCaster {
        const CasterClass = class extends ModelClass {

            public castAttribute<T>(value: T, definition?: BootedFieldDefinition): T {
                return super.castAttribute(value, definition) as T;
            }

        };
        const casterInstance = CasterClass.pureInstance();

        return tap(
            (field, value) => casterInstance.castAttribute(value, casterInstance.static().getFieldDefinition(field)),
            caster => RemovePropertyOperation.attributeCasters.set(ModelClass, caster),
        );
    }

}

export default interface RemovePropertyOperation extends IModel<typeof RemovePropertyOperation> {}
