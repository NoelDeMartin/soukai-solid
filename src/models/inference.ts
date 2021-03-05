import type { ModelConstructor } from 'soukai';

import type { SolidModel } from './SolidModel';
import type SolidContainerModel from './SolidContainerModel';

export type SolidModelConstructor<T extends SolidModel> = ModelConstructor<T> & typeof SolidModel;
export type SolidContainerModelConstructor<T extends SolidContainerModel> =
    SolidModelConstructor<T> & typeof SolidContainerModel;
