import type { Relation } from 'soukai';

import SolidContainer from '@/models/SolidContainer';
import type SolidContainsRelation from '@/models/relations/SolidContainsRelation';

import Movie from '@/testing/lib/stubs/Movie';

export default class MoviesCollection extends SolidContainer {

    public static timestamps = false;

    public movies?: Movie[];
    public relatedMovies!: SolidContainsRelation<this, Movie, typeof Movie>;

    public moviesRelationship(): Relation {
        return this.contains(Movie);
    }

}
