import { bootModels } from 'soukai';

import { historyModels } from './history/index';

import SolidACLAuthorization from './SolidACLAuthorization';
import SolidContainer from './SolidContainer';
import SolidDocument from './SolidDocument';
import SolidTypeIndex from './SolidTypeIndex';
import SolidTypeRegistration from './SolidTypeRegistration';

import type DeletesModels from './mixins/DeletesModels';
import type ManagesPermissions from './mixins/ManagesPermissions';
import type SerializesToJsonLD from './mixins/SerializesToJsonLD';
import type { PermissionsTracker } from './mixins/ManagesPermissions';

export * from './history/index';
export * from './inference';
export * from './relations/index';
export * from './schema';
export * from './SolidModel';

export {
    SolidACLAuthorization,
    SolidContainer,
    SolidDocument,
    SolidTypeIndex,
    SolidTypeRegistration,
};

export { default as SolidACLAuthorizationSchema } from './SolidACLAuthorization.schema';
export { default as SolidContainerSchema } from './SolidContainer.schema';
export { default as SolidDocumentSchema } from './SolidDocument.schema';
export { default as SolidTypeIndexSchema } from './SolidTypeIndex.schema';
export { default as SolidTypeRegistrationSchema } from './SolidTypeRegistration.schema';

export type { DeletesModels, SerializesToJsonLD, ManagesPermissions, PermissionsTracker };

export type { This as DeletesModelsThis } from './mixins/DeletesModels';
export type { This as ManagesPermissionsThis } from './mixins/ManagesPermissions';
export type { This as SerializesToJsonLDThis } from './mixins/SerializesToJsonLD';

export type {
    SolidBootedFieldDefinition,
    SolidBootedFieldsDefinition,
    SolidFieldDefinition,
    SolidFieldsDefinition,
    SolidSchemaDefinition,
} from './fields';

export function bootSolidModels(): void {
    bootModels({
        ...historyModels,
        SolidACLAuthorization,
        SolidContainer,
        SolidDocument,
        SolidTypeIndex,
        SolidTypeRegistration,
    });
}
