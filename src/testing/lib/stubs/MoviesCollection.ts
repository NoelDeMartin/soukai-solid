import type { Relation } from 'soukai';

import SolidContainerModel from '@/models/SolidContainerModel';
import type SolidContainsRelation from '@/models/relations/SolidContainsRelation';

import Movie from '@/testing/lib/stubs/Movie';

export default class MoviesCollection extends SolidContainerModel {

    public static timestamps = false;

    public movies?: Movie[];
    public relatedMovies!: SolidContainsRelation<MoviesCollection, Movie, typeof Movie>;

    public moviesRelationship(): Relation {
        return this.contains(Movie);
    }

}
