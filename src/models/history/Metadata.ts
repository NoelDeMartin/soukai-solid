import { FieldType } from 'soukai';
import type { IModel } from 'soukai';

import { SolidModel } from '@/models/SolidModel';

export default class Metadata extends SolidModel {

    public static rdfContexts = {
        soukai: 'https://soukai.noeldemartin.com/vocab/',
    };

    public static rdfsClasses = ['Metadata'];

    public static timestamps = false;

    public static fields = {
        resourceUrl: {
            type: FieldType.Key,
            required: true,
            rdfProperty: 'resource',
        },
        createdAt: FieldType.Date,
        updatedAt: FieldType.Date,
        deletedAt: FieldType.Date,
    } as const;

    public getCreatedAtAttribute(): Date {
        return this.getAttributeValue('createdAt');
    }

    public getUpdatedAtAttribute(): Date {
        return this.getAttributeValue('updatedAt');
    }

    public getDeletedAtAttribute(): Date {
        return this.getAttributeValue('deletedAt');
    }

    protected newUrl(documentUrl?: string, resourceHash?: string): string {
        if (!this.resourceUrl)
            return super.newUrl(documentUrl, resourceHash);

        return `${this.resourceUrl}-metadata`;
    }

}

export default interface Metadata extends Omit<IModel<typeof Metadata>, 'createdAt' | 'updatedAt'> {}
