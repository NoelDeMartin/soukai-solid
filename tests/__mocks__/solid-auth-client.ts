import { EventEmitter } from 'events';

import StubResponse from '@tests/stubs/StubResponse';

class SolidAuthClientMock extends EventEmitter {

    private fetchResponses: Response[] = [];

    public reset(): void {
        this.fetchResponses = [];
    }

    public addFetchNotFoundResponse(): void {
        this.fetchResponses.push(StubResponse.notFound());
    }

    public addFetchResponse(content: string = '', headers: object = {}): void {
        this.fetchResponses.push(StubResponse.make(content, headers));
    }

    public async fetch(): Promise<Response | undefined> {
        return this.fetchResponses.shift();
    }

}

const instance = new SolidAuthClientMock();

jest.spyOn(instance, 'fetch');

export default instance;
