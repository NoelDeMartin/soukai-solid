export default class StubHeaders implements Headers {

    public static make(data: object): StubHeaders {
        return new StubHeaders(data);
    }

    private data: object;

    private constructor(data: object) {
        this.data = {};

        for (const name in data) {
            this.set(name, data[name]);
        }
    }

    public append(name: string, value: string): void {
        this.data[this.normalizeHeader(name)] = value;
    }

    public delete(name: string): void {
        delete this.data[this.normalizeHeader(name)];
    }

    public get(name: string): string | null {
        return this.data[this.normalizeHeader(name)];
    }

    public has(name: string): boolean {
        return this.normalizeHeader(name) in this.data;
    }

    public set(name: string, value: string): void {
        this.data[this.normalizeHeader(name)] = value;
    }

    public forEach(callbackfn: (value: string, key: string, parent: Headers) => void, thisArg?: any): void {
        for (const key in this.data) {
            callbackfn(this.data[key], key, this);
        }
    }

    private normalizeHeader(name: string): string {
        return name.toLowerCase();
    }

}