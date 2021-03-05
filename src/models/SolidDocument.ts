import { SolidModel } from './SolidModel';
import { TimestampField } from 'soukai';
import type { ModelInterface } from 'soukai';

export default class SolidDocument extends SolidModel {

    public static timestamps = [TimestampField.UpdatedAt];

}

export default interface SolidDocument extends ModelInterface<typeof SolidDocument> {}
