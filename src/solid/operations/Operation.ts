import RDFResourceProperty from '@/solid/RDFResourceProperty';

import Arr from '@/utils/Arr';

import RemovePropertyOperation from './RemovePropertyOperation';
import UpdatePropertyOperation from './UpdatePropertyOperation';

export const enum OperationType {
    UpdateProperty,
    RemoveProperty,
}

export interface IOperation {
    type: OperationType;
}

type UpdateOperation = UpdatePropertyOperation | RemovePropertyOperation;

export function decantUpdateOperationsData(operations: UpdateOperation[]): [RDFResourceProperty[], [string, string?][]] {
    const data: [RDFResourceProperty[], [string, string?][]] = [[], []];

    for (const operation of operations) {
        switch (operation.type) {
            case OperationType.UpdateProperty:
                data[0].push(operation.property);
                break;
            case OperationType.RemoveProperty:
                data[1].push(Arr.filter([operation.resourceUrl, operation.property]) as [string, string?]);
                break;
        }
    }

    return data;
}

export default UpdateOperation;
