import { FieldType } from 'soukai';
import { uuid } from '@noeldemartin/utils';
import type { IModel } from 'soukai';

import { SolidModel } from './SolidModel';

export const enum SolidModelOperationType {
    Set = 'https://soukai.noeldemartin.com/vocab/SetOperation',
    Unset = 'https://soukai.noeldemartin.com/vocab/UnsetOperation',
    Add = 'https://soukai.noeldemartin.com/vocab/AddOperation',
    Remove = 'https://soukai.noeldemartin.com/vocab/RemoveOperation',
}

export default class SolidModelOperation extends SolidModel {

    public static rdfContexts = {
        soukai: 'https://soukai.noeldemartin.com/vocab/',
    };

    public static rdfsClasses = ['Operation'];

    public static timestamps = false;

    public static fields = {
        resourceUrl: {
            type: FieldType.Key,
            required: true,
            rdfProperty: 'resource',
        },
        property: {
            type: FieldType.Key,
            required: true,
        },
        value: {
            type: FieldType.Any,
            required: true,
        },
        date: {
            type: FieldType.Date,
            required: true,
        },
        type: FieldType.Key,
    } as const;

    protected newUrl(documentUrl?: string, resourceHash?: string): string {
        if (!this.resourceUrl)
            return super.newUrl(documentUrl, resourceHash);

        const hashSuffix = resourceHash ?? uuid();

        return `${this.resourceUrl}-operation-${hashSuffix}`;
    }

}

export default interface SolidModelOperation extends IModel<typeof SolidModelOperation> {}
