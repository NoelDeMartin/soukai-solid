import StubHeaders from '@/testing/lib/stubs/StubHeaders';

export default class StubResponse implements Response {

    public static make(
        content: string = '',
        headers: Record<string, string> = {},
        status: number = 200,
    ): StubResponse {
        return new StubResponse(status, content, headers);
    }

    public static notFound(): StubResponse {
        return new StubResponse(404);
    }

    private content: string;

    public readonly body!: ReadableStream<Uint8Array> | null;
    public readonly bodyUsed!: boolean;
    public readonly headers: StubHeaders;
    public readonly ok!: boolean;
    public readonly redirected!: boolean;
    public readonly status: number;
    public readonly statusText!: string;
    public readonly trailer!: Promise<Headers>;
    public readonly type!: ResponseType;
    public readonly url!: string;

    private constructor(status: number, content: string = '', headers: Record<string, string> = {}) {
        this.status = status;
        this.content = content;
        this.headers = StubHeaders.make(headers);
    }

    public async arrayBuffer(): Promise<ArrayBuffer> {
        throw new Error('StubResponse.arrayBuffer is not implemented');
    }

    public async blob(): Promise<Blob> {
        throw new Error('StubResponse.blob is not implemented');
    }

    public async formData(): Promise<FormData> {
        throw new Error('StubResponse.formData is not implemented');
    }

    public async json(): Promise<unknown> {
        return JSON.parse(this.content);
    }

    public async text(): Promise<string> {
        return this.content;
    }

    public clone(): Response {
        return { ...this };
    }

}
