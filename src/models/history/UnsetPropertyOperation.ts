import type { ISolidModel } from '@/models/SolidModel';

import PropertyOperation from './PropertyOperation';

export default class UnsetPropertyOperation extends PropertyOperation {

    public static rdfsClasses = ['UnsetPropertyOperation'];

}

export default interface UnsetPropertyOperation extends ISolidModel<typeof UnsetPropertyOperation> {}
