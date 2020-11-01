import RDFResourceProperty from '@/solid/RDFResourceProperty';

import Operation, { OperationType } from './Operation';

export default class UpdatePropertyOperation implements Operation {

    type: OperationType.UpdateProperty = OperationType.UpdateProperty;

    constructor(public property: RDFResourceProperty) {}

}
