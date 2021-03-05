import { EventEmitter } from 'events';

import StubResponse from '@/testing/lib/stubs/StubResponse';

class StubFetcher extends EventEmitter {

    private fetchResponses: Response[] = [];

    public reset(): void {
        this.fetchResponses = [];
        (this as any).fetch.mockClear();
    }

    public addFetchNotFoundResponse(): void {
        this.fetchResponses.push(StubResponse.notFound());
    }

    public addFetchResponse(content: string = '', headers: Record<string, string> = {}, status: number = 200): void {
        this.fetchResponses.push(StubResponse.make(content, headers, status));
    }

    public async fetch(): Promise<Response> {
        const response = this.fetchResponses.shift();

        if (!response) {
            return new Promise((_, reject) => reject());
        }

        return response;
    }

}

const instance = new StubFetcher();

jest.spyOn(instance, 'fetch');

export default instance;
