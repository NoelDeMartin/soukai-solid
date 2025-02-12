import { defineModelSchema } from 'soukai';
import type { Constructor } from '@noeldemartin/utils';

import { SolidModel } from './SolidModel';
import type { SolidMagicAttributes, SolidModelConstructor } from './inference';
import type { SolidSchemaDefinition } from './fields';

/* eslint-disable max-len */
export function defineSolidModelSchema<Schema extends SolidSchemaDefinition>(definition: Schema): Constructor<SolidMagicAttributes<Schema>> & SolidModelConstructor;
export function defineSolidModelSchema<BaseModel extends SolidModel, Schema extends SolidSchemaDefinition>(baseModel: SolidModelConstructor<BaseModel>, definition: Schema): Constructor<SolidMagicAttributes<Schema>> & SolidModelConstructor<BaseModel>;
/* eslint-enable max-len */

export function defineSolidModelSchema<BaseModel extends SolidModel, Schema extends SolidSchemaDefinition>(
    baseModelOrDefinition: SolidModelConstructor<BaseModel> | Schema,
    definition?: Schema,
): Constructor<SolidMagicAttributes<Schema>> & SolidModelConstructor<BaseModel> {
    const baseModel = definition ? baseModelOrDefinition as SolidModelConstructor : SolidModel;
    const schema = defineModelSchema(
        baseModel,
        definition ?? baseModelOrDefinition as Schema,
    ) as unknown as Constructor<SolidMagicAttributes<Schema>> & SolidModelConstructor<BaseModel>;

    schema.__isSchema = true;

    return schema;
}
