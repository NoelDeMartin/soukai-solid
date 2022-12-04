import { FieldType } from 'soukai';
import type { Relation } from 'soukai';

import { SolidModel } from '@/models/SolidModel';
import type SolidHasManyRelation from '@/models/relations/SolidHasManyRelation';
import type SolidHasOneRelation from '@/models/relations/SolidHasOneRelation';
import type { ISolidModel } from '@/models/SolidModel';

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
        imageUrls: {
            type: FieldType.Array,
            items: FieldType.Key,
            rdfProperty: 'schema:image',
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
        rating: {
            type: FieldType.String,
            rdfProperty: 'schema:contentRating',
        },
    };

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

export default interface Movie extends ISolidModel<typeof Movie> {}
