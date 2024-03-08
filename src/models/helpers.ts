import { expandIRI } from '@noeldemartin/solid-utils';

import SolidContainer from '@/models/SolidContainer';
import type { SolidContainerConstructor, SolidModelConstructor } from '@/main';
import type { SolidModel } from '@/models/SolidModel';

export function isContainer(model: SolidModel): model is SolidContainer {
    return model instanceof SolidContainer;
}

export function isContainerClass(modelClass: SolidModelConstructor): modelClass is SolidContainerConstructor {
    return modelClass.rdfsClasses.includes(expandIRI('ldp:Container'));
}
