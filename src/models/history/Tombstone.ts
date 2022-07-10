import type { IModel } from 'soukai';

import Metadata from './Metadata';

export default class Tombstone extends Metadata {

    public static rdfsClasses = ['Tombstone'];

}

export default interface Tombstone extends IModel<typeof Tombstone> {}
