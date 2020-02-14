import { FieldType } from 'soukai';

import SolidEmbedsRelation from '@/models/relations/SolidEmbedsRelation';
import SolidModel from '@/models/SolidModel';

import WatchAction from '@tests/stubs/WatchAction';

export default class Movie extends SolidModel {

    public static timestamps = false;

    public static rdfContexts = {
        'schema': 'https://schema.org/',
    };

    public static rdfsClasses = ['schema:Movie'];

    public static fields = {
        name: FieldType.String,
    };

    public actionsRelationship(): SolidEmbedsRelation<Movie, WatchAction, typeof WatchAction> {
        return this.embeds(WatchAction) as any;
    }

}
