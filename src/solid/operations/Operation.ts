import ChangeUrlOperation from './ChangeUrlOperation';
import RemovePropertyOperation from './RemovePropertyOperation';
import UpdatePropertyOperation from './UpdatePropertyOperation';

export type UpdateOperation = UpdatePropertyOperation | RemovePropertyOperation | ChangeUrlOperation;

export const enum OperationType {
    UpdateProperty,
    RemoveProperty,
    ChangeUrl,
}

export default interface Operation {
    type: OperationType;
}
