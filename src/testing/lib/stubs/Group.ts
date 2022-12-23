import type { Relation } from 'soukai';

import type SolidBelongsToManyRelation from '@/models/relations/SolidBelongsToManyRelation';
import type SolidBelongsToOneRelation from '@/models/relations/SolidBelongsToOneRelation';

import Person from '@/testing/lib/stubs/Person';

import Model from './Group.schema';

export default class Group extends Model {

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
