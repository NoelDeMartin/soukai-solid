import { FieldType, MultiModelRelation } from 'soukai';

import SolidModel from '@/models/SolidModel';

import Person from '@tests/stubs/Person';

export default class Group extends SolidModel {

    public static timestamps = false;

    public static ldpContainer = true;

    public static rdfContexts = {
        'foaf': 'http://xmlns.com/foaf/0.1/',
    };

    public static rdfsClasses = ['foaf:Group'];

    public static fields = {
        name: FieldType.String,
    };

    public membersRelationship(): MultiModelRelation {
        return this.contains(Person);
    }

}
