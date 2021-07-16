import { FieldType } from 'soukai';
import type { IModel, MultiModelRelation } from 'soukai';

import { SolidModel } from '@/models/SolidModel';
import type { SolidBelongsToManyRelation } from '@/models';

import Person from '@/testing/lib/stubs/Person';

export default class Group extends SolidModel {

    public static timestamps = false;

    public static rdfContexts = {
        foaf: 'http://xmlns.com/foaf/0.1/',
    };

    public static rdfsClasses = ['foaf:Group'];

    public static fields = {
        name: {
            type: FieldType.String,
            required: true,
        },
        memberUrls: {
            type: FieldType.Array,
            rdfProperty: 'foaf:member',
            items: FieldType.Key,
        },
    };

    public members?: Person[];
    public relatedMembers!: SolidBelongsToManyRelation<Group, Person, typeof Person>;

    public membersRelationship(): MultiModelRelation {
        return this.belongsToMany(Person, 'memberUrls');
    }

}

export default interface Group extends IModel<typeof Group> {}
