export default class StubHeaders implements Headers {

    public static make(data: Record<string, string>): StubHeaders {
        return new StubHeaders(data);
    }

    private data: Record<string, string>;

    private constructor(data: Record<string, string>) {
        this.data = {};

        for (const [name, value] of Object.entries(data)) {
            this.set(name, value);
        }
    }

    public [Symbol.iterator](): IterableIterator<[string, string]> {
        throw new Error('Method not implemented.');
    }

    public entries(): IterableIterator<[string, string]> {
        throw new Error('Method not implemented.');
    }

    public keys(): IterableIterator<string> {
        throw new Error('Method not implemented.');
    }

    public values(): IterableIterator<string> {
        throw new Error('Method not implemented.');
    }

    public append(name: string, value: string): void {
        this.data[this.normalizeHeader(name)] = value;
    }

    public delete(name: string): void {
        delete this.data[this.normalizeHeader(name)];
    }

    public get(name: string): string | null {
        return this.data[this.normalizeHeader(name)] ?? null;
    }

    public has(name: string): boolean {
        return this.normalizeHeader(name) in this.data;
    }

    public set(name: string, value: string): void {
        this.data[this.normalizeHeader(name)] = value;
    }

    public forEach(callbackfn: (value: string, name: string, parent: Headers) => void): void {
        for (const [name, value] of Object.entries(this.data)) {
            callbackfn(value, name, this);
        }
    }

    private normalizeHeader(name: string): string {
        return name.toLowerCase();
    }

}
