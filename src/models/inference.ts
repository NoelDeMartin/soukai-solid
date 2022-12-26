import type { Constructor, Pretty } from '@noeldemartin/utils';
import type { GetArrayFields, GetFieldsDefinition, MagicAttributeProperties, MagicAttributes } from 'soukai';

import type SolidContainer from './SolidContainer';
import type { SolidFieldsDefinition, SolidSchemaDefinition } from './fields';
import type { SolidModel } from './SolidModel';

export type SolidMagicAttributes<
    S extends SolidSchemaDefinition,
    F extends SolidFieldsDefinition = GetFieldsDefinition<S>
> = Pretty<
    MagicAttributes<S> &
    MagicAttributeProperties<Pick<F, GetArrayFields<F>>>
>;

export type SolidModelConstructor<T extends SolidModel = SolidModel> = Constructor<T> & typeof SolidModel;
export type SolidContainerConstructor<T extends SolidContainer = SolidContainer> =
    SolidModelConstructor<T> & typeof SolidContainer;
