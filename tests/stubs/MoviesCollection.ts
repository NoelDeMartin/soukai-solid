import { MultiModelRelation } from 'soukai';

import SolidContainerModel from '@/models/SolidContainerModel';
import SolidContainsRelation from '@/models/relations/SolidContainsRelation';

import Movie from '@tests/stubs/Movie';

export default class MoviesCollection extends SolidContainerModel {

    public static timestamps = false;

    movies?: Movie[];
    relatedMovies: SolidContainsRelation<MoviesCollection, Movie, typeof Movie>;

    public moviesRelationship(): MultiModelRelation {
        return this.contains(Movie);
    }

}
