import { OperationType } from './Operation';
import type Operation from './Operation';

export default class ChangeUrlOperation implements Operation {

    public type: OperationType.ChangeUrl = OperationType.ChangeUrl;

    constructor(public resourceUrl: string, public newResourceUrl: string) {}

}
