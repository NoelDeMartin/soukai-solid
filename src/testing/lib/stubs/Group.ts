import { FieldType } from 'soukai';
import type { IModel, Relation } from 'soukai';

import { SolidModel } from '@/models/SolidModel';
import type { SolidBelongsToManyRelation, SolidBelongsToOneRelation } from '@/models';

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
        creatorUrl: {
            type: FieldType.Key,
            rdfProperty: 'foaf:maker',
        },
    };

    public creator?: Person;
    public members?: Person[];
    public relatedCreator!: SolidBelongsToOneRelation<Group, Person, typeof Person>;
    public relatedMembers!: SolidBelongsToManyRelation<Group, Person, typeof Person>;

    public creatorRelationship(): Relation {
        return this
            .belongsToOne(Person, 'creatorUrl')
            .usingSameDocument(true)
            .onDelete('cascade');
    }

    public membersRelationship(): Relation {
        return this.belongsToMany(Person, 'memberUrls');
    }

}

export default interface Group extends IModel<typeof Group> {}
