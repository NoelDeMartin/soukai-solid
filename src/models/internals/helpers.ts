import { SoukaiError, defineModelSchema } from 'soukai';
import type { SchemaDefinition } from 'soukai';
import type { Constructor } from '@noeldemartin/utils';

import type { RDFContexts } from '@/models/fields';
import type { SolidMagicAttributes, SolidModelConstructor } from '@/models/inference';
import type { SolidModel } from '@/models/SolidModel';

const ongoingUpdates = new WeakMap<SolidModelConstructor, RDFContexts>();

export function startSchemaUpdate(modelClass: SolidModelConstructor, context: RDFContexts): void {
    if (ongoingUpdates.has(modelClass)) {
        throw new SoukaiError(`${modelClass.modelName} schema update already in progress!`);
    }

    ongoingUpdates.set(modelClass, context);
}

export function getSchemaUpdateContext(modelClass: SolidModelConstructor): RDFContexts | null {
    const context = ongoingUpdates.get(modelClass);

    return context ?? null;
}

export function stopSchemaUpdate(modelClass: SolidModelConstructor): void {
    ongoingUpdates.delete(modelClass);
}

export function defineSolidModelSchemaDecoupled<BaseModel extends SolidModel, Schema extends SchemaDefinition>(
    baseModelOrDefinition: SolidModelConstructor<BaseModel> | Schema,
    defaultModel: SolidModelConstructor,
    definition?: Schema,
): Constructor<SolidMagicAttributes<Schema>> & SolidModelConstructor<BaseModel> {
    const baseModel = definition ? baseModelOrDefinition as SolidModelConstructor : defaultModel;
    const schema = defineModelSchema(
        baseModel,
        definition ?? baseModelOrDefinition as Schema,
    ) as unknown as Constructor<SolidMagicAttributes<Schema>> & SolidModelConstructor<BaseModel>;

    schema.__isSchema = true;

    return schema;
}
