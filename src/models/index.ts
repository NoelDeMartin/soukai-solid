import { bootModels } from 'soukai';

import type { JsonLD, JsonLDResource } from '@/solid/utils/RDF';

import type DeletesModels from './mixins/DeletesModels';
import type SerializesToJsonLD from './mixins/SerializesToJsonLD';

import SolidContainerModel from './SolidContainerModel';
import SolidDocument from './SolidDocument';
import SolidModelMetadata from './SolidModelMetadata';
import SolidModelOperation from './SolidModelOperation';
import SolidTypeRegistration from './SolidTypeRegistration';

export * from './inference';
export * from './relations/index';
export * from './SolidModel';

export {
    SolidContainerModel,
    SolidDocument,
    SolidModelMetadata,
    SolidModelOperation,
    SolidTypeRegistration,
};

export type {
    DeletesModels,
    JsonLD,
    JsonLDResource,
    SerializesToJsonLD,
};

export type {
    SolidFieldsDefinition,
    SolidBootedFieldsDefinition,
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
