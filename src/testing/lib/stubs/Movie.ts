import type { Relation } from 'soukai';

import type SolidHasManyRelation from '@/models/relations/SolidHasManyRelation';
import type SolidHasOneRelation from '@/models/relations/SolidHasOneRelation';

import MoviesCollection from '@/testing/lib/stubs/MoviesCollection';
import Person from '@/testing/lib/stubs/Person';
import WatchAction from '@/testing/lib/stubs/WatchAction';

import Model from './Movie.schema';

export default class Movie extends Model {

    public director: Person | undefined;
    public relatedDirector!: SolidHasOneRelation<Movie, Person, typeof Person>;
    public actions: WatchAction[] | undefined;
    public relatedActions!: SolidHasManyRelation<Movie, WatchAction, typeof WatchAction>;
    public actors: Person[] | undefined;
    public relatedActors!: SolidHasManyRelation<Movie, Person, typeof Person>;
    public collection: MoviesCollection | undefined;

    public directorRelationship(): Relation {
        return this
            .hasOne(Person, 'directed')
            .usingSameDocument()
            .onDelete('cascade');
    }

    public actorsRelationship(): Relation {
        return this
            .hasMany(Person, 'starred')
            .usingSameDocument()
            .onDelete('cascade');
    }

    public actionsRelationship(): Relation {
        return this
            .hasMany(WatchAction, 'object')
            .usingSameDocument()
            .onDelete('cascade');
    }

    public collectionRelationship(): Relation {
        return this.isContainedBy(MoviesCollection);
    }

}
