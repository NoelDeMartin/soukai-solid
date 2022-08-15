import { bootModels } from 'soukai';

import { historyModels } from './history/index';

import SolidACLAuthorization from './SolidACLAuthorization';
import SolidContainerModel from './SolidContainerModel';
import SolidDocument from './SolidDocument';
import SolidTypeIndex from './SolidTypeIndex';
import SolidTypeRegistration from './SolidTypeRegistration';

import type DeletesModels from './mixins/DeletesModels';
import type ManagesPermissions from './mixins/ManagesPermissions';
import type SerializesToJsonLD from './mixins/SerializesToJsonLD';

export * from './inference';
export * from './relations/index';
export * from './history/index';
export * from './SolidModel';

export {
    SolidACLAuthorization,
    SolidContainerModel,
    SolidDocument,
    SolidTypeIndex,
    SolidTypeRegistration,
};

export type { DeletesModels, SerializesToJsonLD, ManagesPermissions };

export type { This as DeletesModelsThis } from './mixins/DeletesModels';
export type { This as ManagesPermissionsThis } from './mixins/ManagesPermissions';
export type { This as SerializesToJsonLDThis } from './mixins/SerializesToJsonLD';

export type {
    SolidBootedFieldDefinition,
    SolidBootedFieldsDefinition,
    SolidFieldDefinition,
    SolidFieldsDefinition,
} from './fields';

export function bootSolidModels(): void {
    bootModels({
        ...historyModels,
        SolidACLAuthorization,
        SolidContainerModel,
        SolidDocument,
        SolidTypeRegistration,
    });
}
