import Operation, { OperationType } from './Operation';

export default class RemovePropertyOperation implements Operation {

    type: OperationType.RemoveProperty = OperationType.RemoveProperty;

    constructor(public resourceUrl: string, public property?: string) {}

}
