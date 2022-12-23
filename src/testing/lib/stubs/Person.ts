import { stringToSlug } from '@noeldemartin/utils';
import type { Relation } from 'soukai';

import type SolidBelongsToManyRelation from '@/models/relations/SolidBelongsToManyRelation';

import Group from '@/testing/lib/stubs/Group';
import Movie from '@/testing/lib/stubs/Movie';

import Model from './Person.schema';

export default class Person extends Model {

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
