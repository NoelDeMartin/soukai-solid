import { bootModels } from 'soukai';

import type { JsonLD } from '@/solid/utils/RDF';

import type DeletesModels from './mixins/DeletesModels';
import type { RDFContext } from './mixins/SerializesToJsonLD';
import type SerializesToJsonLD from './mixins/SerializesToJsonLD';

import SolidContainerModel from './SolidContainerModel';
import SolidDocument from './SolidDocument';

export * from './inference';
export * from './relations/index';
export * from './SolidModel';

export {
    SolidContainerModel,
    SolidDocument,
};

export type {
    DeletesModels,
    JsonLD,
    RDFContext,
    SerializesToJsonLD,
};

export type {
    SolidFieldsDefinition,
    SolidBootedFieldsDefinition,
} from './fields';

export function bootSolidModels(): void {
    bootModels({ SolidDocument });
}
