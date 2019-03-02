import { EventEmitter } from 'events';

import StubResponse from '@tests/stubs/StubResponse';

class MockSolidAuthClient extends EventEmitter {

    private fetchResponses: Response[] = [];

    public addFetchResponse(content: string): void {
        this.fetchResponses.push(StubResponse.make(content));
    }

    public async fetch(): Promise<Response | undefined> {
        return this.fetchResponses.shift();
    }

}

const instance = new MockSolidAuthClient();
jest.spyOn(instance, 'fetch');

export default instance;
