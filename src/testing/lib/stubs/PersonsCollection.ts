import type { Relation } from 'soukai';

import SolidContainer from '@/models/SolidContainer';
import type SolidContainsRelation from '@/models/relations/SolidContainsRelation';

import Person from '@/testing/lib/stubs/Person';

export default class PersonsCollection extends SolidContainer {

    public static timestamps = false;

    public persons?: Person[];
    public relatedPersons!: SolidContainsRelation<this, Person, typeof Person>;

    public personsRelationship(): Relation {
        return this.contains(Person);
    }

}
