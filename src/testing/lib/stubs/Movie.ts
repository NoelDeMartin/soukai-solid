import { FieldType } from 'soukai';
import type { IModel, Relation } from 'soukai';

import { SolidModel } from '@/models/SolidModel';
import type SolidHasManyRelation from '@/models/relations/SolidHasManyRelation';

import WatchAction from '@/testing/lib/stubs/WatchAction';

export default class Movie extends SolidModel {

    public static timestamps = false;

    public static rdfContexts = {
        schema: 'https://schema.org/',
    };

    public static rdfsClasses = ['schema:Movie'];

    public static fields = {
        name: FieldType.String,
    };

    public actions: WatchAction[] | undefined;
    public relatedActions!: SolidHasManyRelation<Movie, WatchAction, typeof WatchAction>;

    public actionsRelationship(): Relation {
        return this
            .hasMany(WatchAction, 'object')
            .usingSameDocument()
            .onDelete('cascade');
    }

}

export default interface Movie extends IModel<typeof Movie> {}
