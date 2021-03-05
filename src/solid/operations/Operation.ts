import type ChangeUrlOperation from './ChangeUrlOperation';
import type RemovePropertyOperation from './RemovePropertyOperation';
import type UpdatePropertyOperation from './UpdatePropertyOperation';

export type UpdateOperation = UpdatePropertyOperation | RemovePropertyOperation | ChangeUrlOperation;

export const enum OperationType {
    UpdateProperty,
    RemoveProperty,
    ChangeUrl,
}

export default interface Operation {
    type: OperationType;
}
