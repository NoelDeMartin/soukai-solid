import { FieldType, Relation, SingleModelRelation } from 'soukai';

import SolidModel from '@/models/SolidModel';

import Group from '@tests/stubs/Group';

export default class Person extends SolidModel {

    public static timestamps = false;

    public static rdfContexts = {
        'foaf': 'http://cmlns.com/foaf/0.1/',
    };

    public static rdfsClasses = ['foaf:Person'];

    public static fields = {
        name: FieldType.String,
        knows: {
            type: FieldType.Key,
            rdfProperty: 'foaf:knows',
        },
    };

    public friendsRelationship(): Relation {
        return this.hasMany(Person, 'knows');
    }

    public groupRelationship(): SingleModelRelation {
        return this.isContainedBy(Group);
    }

}
