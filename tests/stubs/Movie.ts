import { FieldType, Relation } from 'soukai';

import SolidHasManyRelation from '@/models/relations/SolidHasManyRelation';
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

    public actions: WatchAction[] | undefined;
    public relatedActions: SolidHasManyRelation<Movie, WatchAction, typeof WatchAction>;

    public actionsRelationship(): Relation {
        return this
            .hasMany(WatchAction, 'object')
            .usingSameDocument(true)
            .onDelete('cascade');
    }

}
