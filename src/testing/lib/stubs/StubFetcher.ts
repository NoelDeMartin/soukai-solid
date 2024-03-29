import { EventEmitter } from 'events';

import StubResponse from '@/testing/lib/stubs/StubResponse';

class StubFetcher extends EventEmitter {

    public fetchSpy!: jest.SpyInstance<Promise<Response>, [RequestInfo, RequestInit?]>;

    private fetchResponses: Response[] = [];

    public reset(): void {
        this.fetchResponses = [];

        this.fetchSpy.mockClear();
    }

    public addFetchNotFoundResponse(): void {
        this.fetchResponses.push(StubResponse.notFound());
    }

    public addFetchResponse(content: string = '', headers: Record<string, string> = {}, status: number = 200): void {
        this.fetchResponses.push(StubResponse.make(content, headers, status));
    }

    public async fetch(_: RequestInfo, __?: RequestInit): Promise<Response> {
        const response = this.fetchResponses.shift();

        if (!response) {
            return new Promise((_, reject) => reject());
        }

        return response;
    }

}

const instance = new StubFetcher();

instance.fetchSpy = jest.spyOn(instance, 'fetch');

export default instance;
