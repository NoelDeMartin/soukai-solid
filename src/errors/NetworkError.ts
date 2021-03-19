import { SoukaiError } from 'soukai';

export default class NetworkError extends SoukaiError {

    public readonly original?: Error;

    constructor(message: string, original?: Error) {
        super(`${message} (${original?.message})`);

        this.original = original;
    }

}
