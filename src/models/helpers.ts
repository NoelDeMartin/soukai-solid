import SolidContainer from '@/models/SolidContainer';
import { LDP_CONTAINER } from '@/solid/constants';
import type { SolidContainerConstructor, SolidModelConstructor } from '@/main';
import type { SolidModel } from '@/models/SolidModel';

export function isContainer(model: SolidModel): model is SolidContainer {
    return model instanceof SolidContainer;
}

export function isContainerClass(modelClass: SolidModelConstructor): modelClass is SolidContainerConstructor {
    return modelClass.rdfsClasses.includes(LDP_CONTAINER);
}
