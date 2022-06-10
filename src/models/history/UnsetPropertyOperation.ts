import type { IModel } from 'soukai';

import PropertyOperation from './PropertyOperation';

export default class UnsetPropertyOperation extends PropertyOperation {

    public static rdfsClasses = ['UnsetPropertyOperation'];

}

export default interface UnsetPropertyOperation extends IModel<typeof UnsetPropertyOperation> {}
