import { FieldType } from 'soukai';

import SolidModel from '@/models/SolidModel';

export default class WatchAction extends SolidModel {

    public static timestamps = false;

    public static ldpResource = false;

    public static rdfContexts = {
        'schema': 'https://schema.org/',
    };

    public static rdfsClasses = ['schema:WatchAction'];

    public static fields = {
        object: FieldType.Key,
    };

}
