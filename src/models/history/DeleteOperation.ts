import type { IModel } from 'soukai';

import type { SolidModel } from '@/models/SolidModel';

import Operation from './Operation';

export default class DeleteOperation extends Operation {

    public static rdfsClasses = ['DeleteOperation'];

    public apply(model: SolidModel): void {
        model.metadata.setAttribute('deletedAt', this.date);
    }

}

export default interface DeleteOperation extends IModel<typeof DeleteOperation> {}
