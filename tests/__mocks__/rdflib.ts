import StubResponse from '@tests/stubs/StubResponse';

type ResponseCallback = (url: string) => Response;
type MockResponse = Response | ResponseCallback;

class RDFLibMock {

    private original;

    private mock;

    private webOperationResponses: MockResponse[] = [];

    constructor() {
        this.original = require('rdflib');
        this.mock = this.createMock(this.original);
    }

    public addWebOperationResponseCallback(callback: ResponseCallback): void {
        this.webOperationResponses.push(callback);
    }

    public addWebOperationResponse(content: string, headers: object = {}): void {
        this.webOperationResponses.push(StubResponse.make(content, headers));
    }

    public getOriginal(): any {
        return this.original;
    }

    public getMock(): any {
        return this.mock;
    }

    private createMock(original: any): any {
        const mock = jest.genMockFromModule<any>('rdflib');

        const spies = ['Namespace', 'graph', 'parse', 'sym'];
        for (const spy of spies) {
            mock[spy] = jest.spyOn(original, spy);
        }

        const proxies = ['NamedNode'];
        for (const proxy of proxies) {
            mock[proxy] = original[proxy];
        }

        const instance = this;

        mock.Fetcher = jest.fn(function (this: any) {
            this.webOperation = jest.fn((method: string, url: string, options: object) => {
                const response = instance.webOperationResponses.shift();

                if (typeof response === 'function') {
                    return response(url);
                } else {
                    return response;
                }
            });
        });

        return mock;
    }

}

const instance = new RDFLibMock();
const $rdf = instance.getOriginal();

export const mock = instance;

export const NamedNode = $rdf.NamedNode;
export const IndexedFormula = $rdf.IndexedFormula;

export default instance.getMock();
