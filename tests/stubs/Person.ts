import { FieldType } from 'soukai';

import SolidModel from '@/models/SolidModel';

export default class Person extends SolidModel {

    public static timestamps = false;

    public static rdfContexts = {
        'foaf': 'http://cmlns.com/foaf/0.1/',
    };

    public static rdfsClasses = ['foaf:Person'];

    public static fields = {
        name: {
            type: FieldType.String,
            rdfProperty: 'foaf:name',
        },
    };

}
