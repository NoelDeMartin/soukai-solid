import { SolidModel } from './SolidModel';
import { TimestampField } from 'soukai';
import type { IModel } from 'soukai';

export default class SolidDocument extends SolidModel {

    public static timestamps = [TimestampField.UpdatedAt];
    public static rdfsClasses = ['ldp:Resource'];

}

export default interface SolidDocument extends IModel<typeof SolidDocument> {}
