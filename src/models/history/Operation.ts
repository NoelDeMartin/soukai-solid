import { FieldType } from 'soukai';
import { uuid } from '@noeldemartin/utils';

import { SolidModel } from '@/models/SolidModel';
import type { ISolidModel } from '@/models/SolidModel';

export const OperationFieldsDefinition = {
    resourceUrl: {
        type: FieldType.Key,
        required: true,
        rdfProperty: 'resource',
    },
    date: {
        type: FieldType.Date,
        required: true,
    },
} as const;

export default class Operation extends SolidModel {

    public static rdfContexts = {
        crdt: 'https://vocab.noeldemartin.com/crdt/',
    };

    public static rdfsClasses = ['Operation'];

    public static timestamps = false;

    public static fields = OperationFieldsDefinition;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public apply(model: SolidModel): void {
        //
    }

    protected newUrl(documentUrl?: string, resourceHash?: string): string {
        if (!this.resourceUrl)
            return super.newUrl(documentUrl, resourceHash);

        const hashSuffix = resourceHash ?? uuid();

        return `${this.resourceUrl}-operation-${hashSuffix}`;
    }

}

export default interface Operation extends ISolidModel<typeof Operation> {}
