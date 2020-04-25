import { FieldType, Relation, SingleModelRelation } from 'soukai';

import SolidModel from '@/models/SolidModel';

import Group from '@tests/stubs/Group';

export default class Person extends SolidModel {

    public static timestamps = false;

    public static rdfContexts = {
        'foaf': 'http://xmlns.com/foaf/0.1/',
    };

    public static rdfsClasses = ['foaf:Person'];

    public static fields = {
        name: FieldType.String,
        friendUrls: {
            type: FieldType.Array,
            rdfProperty: 'foaf:knows',
            items: { type: FieldType.Key },
        },
    };

    public friendsRelationship(): Relation {
        return this.hasMany(Person, 'friendUrls');
    }

    public groupRelationship(): SingleModelRelation {
        return this.isContainedBy(Group);
    }

}
