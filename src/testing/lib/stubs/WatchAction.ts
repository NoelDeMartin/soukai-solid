import { FieldType } from 'soukai';
import type { ModelInterface, SingleModelRelation } from 'soukai';

import { SolidModel } from '@/models/SolidModel';

import Movie from './Movie';

export default class WatchAction extends SolidModel {

    public static timestamps = false;

    public static rdfContexts = {
        schema: 'https://schema.org/',
    };

    public static rdfsClasses = ['schema:WatchAction'];

    public static fields = {
        object: FieldType.Key,
        startTime: FieldType.Date,
    };

    movieRelationship(): SingleModelRelation {
        return this.belongsToOne(Movie, 'object');
    }

}

export default interface WatchAction extends ModelInterface<typeof WatchAction> {}
