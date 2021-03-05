import type { ModelInterface, Relation, SingleModelRelation } from 'soukai';
import { FieldType, TimestampField } from 'soukai';

import { SolidModel } from '@/models/SolidModel';

import Group from '@/testing/lib/stubs/Group';

export default class Person extends SolidModel {

    public static timestamps = [TimestampField.CreatedAt];

    public static rdfContexts = {
        foaf: 'http://xmlns.com/foaf/0.1/',
    };

    public static rdfsClasses = ['foaf:Person'];

    public static fields = {
        name: FieldType.String,
        lastName: FieldType.String,
        friendUrls: {
            type: FieldType.Array,
            rdfProperty: 'foaf:knows',
            items: FieldType.Key,
        },
    };

    friends?: Person[];
    group?: Group;

    public friendsRelationship(): Relation {
        return this.belongsToMany(Person, 'friendUrls');
    }

    public groupRelationship(): SingleModelRelation {
        return this.isContainedBy(Group);
    }

}

export default interface Person extends ModelInterface<typeof Person> {}