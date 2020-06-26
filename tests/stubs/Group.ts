import { FieldType, MultiModelRelation } from 'soukai';

import SolidContainerModel from '@/models/SolidContainerModel';
import SolidContainsRelation from '@/models/relations/SolidContainsRelation';

import Person from '@tests/stubs/Person';

export default class Group extends SolidContainerModel {

    public static timestamps = false;

    public static rdfContexts = {
        'foaf': 'http://xmlns.com/foaf/0.1/',
    };

    public static rdfsClasses = ['foaf:Group'];

    public static fields = {
        name: FieldType.String,
    };

    members?: Person[];
    relatedMembers: SolidContainsRelation<Group, Person, typeof Person>;

    public membersRelationship(): MultiModelRelation {
        return this.contains(Person);
    }

}
