import { SoukaiError } from 'soukai';

import type { RDFContexts, SolidModelConstructor } from '@/models';

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
