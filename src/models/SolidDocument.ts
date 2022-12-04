import { FieldType } from 'soukai';

import { SolidModel } from './SolidModel';
import type { ISolidModel } from './SolidModel';

export default class SolidDocument extends SolidModel {

    public static timestamps = false;

    public static rdfsClasses = ['ldp:Resource'];

    public static fields = {
        updatedAt: {
            type: FieldType.Date,
            rdfProperty: 'purl:modified',
        },
    } as const;

}

export default interface SolidDocument extends Omit<ISolidModel<typeof SolidDocument>, 'updatedAt'> {}
