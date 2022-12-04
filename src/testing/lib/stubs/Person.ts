import { FieldType, TimestampField } from 'soukai';
import { stringToSlug } from '@noeldemartin/utils';
import type { Relation, TimestampFieldValue } from 'soukai';

import type SolidBelongsToManyRelation from '@/models/relations/SolidBelongsToManyRelation';
import { SolidModel } from '@/models/SolidModel';
import type { ISolidModel } from '@/models/SolidModel';

import Group from '@/testing/lib/stubs/Group';
import Movie from '@/testing/lib/stubs/Movie';

export default class Person extends SolidModel {

    public static timestamps: boolean | TimestampFieldValue[] = [TimestampField.CreatedAt];

    public static rdfContexts = {
        foaf: 'http://xmlns.com/foaf/0.1/',
    };

    public static rdfsClasses = ['foaf:Person'];

    public static fields = {
        name: FieldType.String,
        lastName: FieldType.String,
        givenName: FieldType.String,
        age: FieldType.Number,
        directed: {
            type: FieldType.Key,
            rdfProperty: 'foaf:made',
        },
        starred: {
            type: FieldType.Array,
            rdfProperty: 'foaf:pastProject',
            items: FieldType.Key,
        },
        friendUrls: {
            type: FieldType.Array,
            rdfProperty: 'foaf:knows',
            items: FieldType.Key,
        },
    } as const;

    public friends?: Person[];
    public relatedFriends!: SolidBelongsToManyRelation<Person, Person, typeof Person>;
    public relatedStarredMovies!: SolidBelongsToManyRelation<Person, Movie, typeof Movie>;
    public group?: Group;

    public friendsRelationship(): Relation {
        return this.belongsToMany(Person, 'friendUrls');
    }

    public groupRelationship(): Relation {
        return this.hasOne(Group, 'memberUrls');
    }

    public starredMovies(): Relation {
        return this.belongsToMany(Movie, 'starred');
    }

    protected newUrl(documentUrl?: string, resourceHash?: string): string {
        if (this.name && documentUrl && resourceHash !== this.static('defaultResourceHash')) {
            return `${documentUrl}#${stringToSlug(this.name)}`;
        }

        return super.newUrl(documentUrl, resourceHash);
    }

}

export default interface Person extends ISolidModel<typeof Person> {}
