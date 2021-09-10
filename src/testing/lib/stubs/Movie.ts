import { FieldType } from 'soukai';
import type { IModel, Relation } from 'soukai';

import { SolidModel } from '@/models/SolidModel';
import type SolidHasManyRelation from '@/models/relations/SolidHasManyRelation';
import type SolidHasOneRelation from '@/models/relations/SolidHasOneRelation';

import MoviesCollection from '@/testing/lib/stubs/MoviesCollection';
import Person from '@/testing/lib/stubs/Person';
import WatchAction from '@/testing/lib/stubs/WatchAction';

export default class Movie extends SolidModel {

    public static timestamps = false;

    public static rdfContexts = {
        schema: 'https://schema.org/',
    };

    public static rdfsClasses = ['schema:Movie'];

    public static fields = {
        title: {
            rdfProperty: 'schema:name',
            type: FieldType.String,
        },
        externalUrls: {
            type: FieldType.Array,
            rdfProperty: 'schema:sameAs',
            items: FieldType.Key,
        },
        releaseDate: {
            type: FieldType.Date,
            rdfProperty: 'schema:datePublished',
        },
    };

    public director: Person | undefined;
    public relatedDirector!: SolidHasOneRelation<Movie, Person, typeof Person>;
    public actions: WatchAction[] | undefined;
    public relatedActions!: SolidHasManyRelation<Movie, WatchAction, typeof WatchAction>;
    public collection: MoviesCollection | undefined;

    public directorRelationship(): Relation {
        return this
            .hasOne(Person, 'directed')
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

export default interface Movie extends IModel<typeof Movie> {}
