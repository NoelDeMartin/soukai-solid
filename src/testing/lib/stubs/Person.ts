import { FieldType, TimestampField } from 'soukai';
import { stringToSlug } from '@noeldemartin/utils';
import type { IModel, Relation, TimestampFieldValue } from 'soukai';

import { SolidModel } from '@/models/SolidModel';
import type { SolidHasManyRelation } from '@/models';

import Group from '@/testing/lib/stubs/Group';

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
        friendUrls: {
            type: FieldType.Array,
            rdfProperty: 'foaf:knows',
            items: FieldType.Key,
        },
    } as const;

    public friends?: Person[];
    public relatedFriends!: SolidHasManyRelation<Person, Person, typeof Person>;
    public group?: Group;

    public friendsRelationship(): Relation {
        return this.belongsToMany(Person, 'friendUrls');
    }

    public groupRelationship(): Relation {
        return this.hasOne(Group, 'memberUrls');
    }

    protected newUrl(documentUrl?: string, resourceHash?: string): string {
        if (this.name && documentUrl && resourceHash !== this.static('defaultResourceHash')) {
            return `${documentUrl}#${stringToSlug(this.name)}`;
        }

        return super.newUrl(documentUrl, resourceHash);
    }

}

export default interface Person extends IModel<typeof Person> {}
