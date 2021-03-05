import type RDFResourceProperty from '@/solid/RDFResourceProperty';

import { OperationType } from './Operation';
import type Operation from './Operation';

export default class UpdatePropertyOperation implements Operation {

    type: OperationType.UpdateProperty = OperationType.UpdateProperty;

    constructor(public property: RDFResourceProperty) {}

}
