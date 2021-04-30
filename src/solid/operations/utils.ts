import { arrayFilter } from '@noeldemartin/utils';

import type RDFResourceProperty from '@/solid/RDFResourceProperty';

import { OperationType } from './Operation';
import type { UpdateOperation } from './Operation';
import type ChangeUrlOperation from './ChangeUrlOperation';
import type RemovePropertyOperation from './RemovePropertyOperation';
import type UpdatePropertyOperation from './UpdatePropertyOperation';

interface DecantedUpdateOperations {
    [OperationType.UpdateProperty]: UpdatePropertyOperation[];
    [OperationType.RemoveProperty]: RemovePropertyOperation[];
    [OperationType.ChangeUrl]: ChangeUrlOperation[];
}

type DecantedUpdateOperationsData = [RDFResourceProperty[], [string, string?, unknown?][]];

export function decantUpdateOperations(operations: UpdateOperation[]): DecantedUpdateOperations {
    return operations.reduce(
        (decantedOperations, operation) => {
            decantedOperations[operation.type].push(operation as never);

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
                        arrayFilter([
                            operation.resourceUrl,
                            operation.property,
                            operation.value,
                        ]) as [string, string?, unknown?],
                    );
                    break;
            }

            return data;
        },
        [[], []] as DecantedUpdateOperationsData,
    );
}
