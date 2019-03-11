import { FieldType } from 'soukai';

import SolidModel from '@/models/SolidModel';

export default class Group extends SolidModel {

    public static timestamps = false;

    public static ldpContainer = true;

    public static rdfContexts = {
        'foaf': 'http://cmlns.com/foaf/0.1/',
    };

    public static rdfsClasses = ['foaf:Group'];

    public static fields = {
        name: FieldType.String,
    };

}
