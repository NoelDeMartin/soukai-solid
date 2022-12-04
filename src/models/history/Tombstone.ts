import type { ISolidModel } from '@/models/SolidModel';

import Metadata from './Metadata';

export default class Tombstone extends Metadata {

    public static rdfsClasses = ['Tombstone'];

}

export default interface Tombstone extends ISolidModel<typeof Tombstone> {}
