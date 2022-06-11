import { FieldType } from 'soukai';
import type { IModel } from 'soukai';

import { SolidModel } from '@/models/SolidModel';

export default class Tombstone extends SolidModel {

    public static rdfContexts = {
        soukai: 'https://soukai.noeldemartin.com/vocab/',
    };

    public static rdfsClasses = ['Tombstone'];

    public static timestamps = false;

    public static fields = {
        deletedAt: FieldType.Date,
    } as const;

}

export default interface Tombstone extends IModel<typeof Tombstone> {}
