import RDFResourceProperty from '@/solid/RDFResourceProperty';

import Arr from '@/utils/Arr';

import { OperationType, UpdateOperation } from './Operation';
import ChangeUrlOperation from './ChangeUrlOperation';
import RemovePropertyOperation from './RemovePropertyOperation';
import UpdatePropertyOperation from './UpdatePropertyOperation';

interface DecantedUpdateOperations {
    [OperationType.UpdateProperty]: UpdatePropertyOperation[],
    [OperationType.RemoveProperty]: RemovePropertyOperation[],
    [OperationType.ChangeUrl]: ChangeUrlOperation[],
}

type DecantedUpdateOperationsData = [RDFResourceProperty[], [string, string?, any?][]];

export function decantUpdateOperations(operations: UpdateOperation[]): DecantedUpdateOperations {
    return operations.reduce(
        (decantedOperations, operation) => {
            decantedOperations[operation.type].push(operation as any);

            return decantedOperations;
        },
        {
            [OperationType.UpdateProperty]: [],
            [OperationType.RemoveProperty]: [],
            [OperationType.ChangeUrl]: [],
        } as DecantedUpdateOperations,
    );
}

export function decantUpdateOperationsData(operations: UpdateOperation[]): DecantedUpdateOperationsData {
    return operations.reduce(
        (data, operation) => {
            switch (operation.type) {
                case OperationType.UpdateProperty:
                    data[0].push(operation.property);
                    break;
                case OperationType.RemoveProperty:
                    data[1].push(
                        Arr.filter([
                            operation.resourceUrl,
                            operation.property,
                            operation.value,
                        ]) as [string, string?, any?],
                    );
                    break;
            }

            return data;
        },
        [[], []] as DecantedUpdateOperationsData,
    );
}
