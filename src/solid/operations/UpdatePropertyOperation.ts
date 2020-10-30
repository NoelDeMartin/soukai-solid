import RDFResourceProperty from '@/solid/RDFResourceProperty';

import { OperationType, IOperation } from './Operation';

export default class UpdatePropertyOperation implements IOperation {

    type: OperationType.UpdateProperty = OperationType.UpdateProperty;

    constructor(public property: RDFResourceProperty) {}

}
