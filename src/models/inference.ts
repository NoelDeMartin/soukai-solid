import type { Constructor } from '@noeldemartin/utils';

import type { SolidModel } from './SolidModel';
import type SolidContainerModel from './SolidContainerModel';

export type SolidModelConstructor<T extends SolidModel = SolidModel> = Constructor<T> & typeof SolidModel;
export type SolidContainerModelConstructor<T extends SolidContainerModel = SolidContainerModel> =
    SolidModelConstructor<T> & typeof SolidContainerModel;
