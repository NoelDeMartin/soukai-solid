import { OperationType, IOperation } from './Operation';

export default class RemovePropertyOperation implements IOperation {

    type: OperationType.RemoveProperty = OperationType.RemoveProperty;

    constructor(public resourceUrl: string, public property?: string) {}

}
