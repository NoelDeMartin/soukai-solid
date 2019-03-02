export default class StubResponse implements Response {

    public static make(content: string): StubResponse {
        return new StubResponse(content);
    }

    private content: string;

    readonly body: ReadableStream<Uint8Array> | null;
    readonly bodyUsed: boolean;
    readonly headers: Headers;
    readonly ok: boolean;
    readonly redirected: boolean;
    readonly status: number;
    readonly statusText: string;
    readonly trailer: Promise<Headers>;
    readonly type: ResponseType;
    readonly url: string;

    private constructor(content: string) {
        this.content = content;
    }

    public async arrayBuffer(): Promise<ArrayBuffer> {
        // TODO

        return null as any;
    }

    public async blob(): Promise<Blob> {
        // TODO
        return null as any;
    }

    public async formData(): Promise<FormData> {
        // TODO
        return null as any;
    }

    public async json(): Promise<any> {
        return JSON.parse(this.content);
    }

    public async text(): Promise<string> {
        return this.content;
    }

    public clone(): Response {
        return { ...this };
    }

}
