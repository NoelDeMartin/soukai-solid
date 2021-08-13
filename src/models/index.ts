import { bootModels } from 'soukai';

import type DeletesModels from './mixins/DeletesModels';
import type SerializesToJsonLD from './mixins/SerializesToJsonLD';

import SolidContainerModel from './SolidContainerModel';
import SolidDocument from './SolidDocument';
import SolidModelMetadata from './SolidModelMetadata';
import SolidModelOperation, { SolidModelOperationType } from './SolidModelOperation';
import SolidTypeRegistration from './SolidTypeRegistration';

export * from './inference';
export * from './relations/index';
export * from './SolidModel';

export {
    SolidContainerModel,
    SolidDocument,
    SolidModelMetadata,
    SolidModelOperation,
    SolidModelOperationType,
    SolidTypeRegistration,
};

export type { DeletesModels, SerializesToJsonLD };

export type { This as DeletesModelsThis } from './mixins/DeletesModels';
export type { This as SerializesToJsonLDThis } from './mixins/SerializesToJsonLD';

export type {
    SolidBootedFieldDefinition,
    SolidBootedFieldsDefinition,
    SolidFieldDefinition,
    SolidFieldsDefinition,
} from './fields';

export function bootSolidModels(): void {
    bootModels({
        SolidContainerModel,
        SolidDocument,
        SolidModelMetadata,
        SolidModelOperation,
        SolidTypeRegistration,
    });
}
