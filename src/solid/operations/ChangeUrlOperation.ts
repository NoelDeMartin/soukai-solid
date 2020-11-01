import Operation, { OperationType } from './Operation';

export default class ChangeUrlOperation implements Operation {

    type: OperationType.ChangeUrl = OperationType.ChangeUrl;

    constructor(public resourceUrl: string, public newResourceUrl: string) {}

}
