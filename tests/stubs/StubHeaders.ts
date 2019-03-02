export default class StubHeaders implements Headers {

    public static make(data: object): StubHeaders {
        return new StubHeaders(data);
    }

    private data: object;

    private constructor(data: object) {
        this.data = data;
    }

    public append(name: string, value: string): void {
        this.data[name] = value;
    }

    public delete(name: string): void {
        delete this.data[name];
    }

    public get(name: string): string | null {
        return this.data[name];
    }

    public has(name: string): boolean {
        return name in this.data;
    }

    public set(name: string, value: string): void {
        this.data[name] = value;
    }

    public forEach(callbackfn: (value: string, key: string, parent: Headers) => void, thisArg?: any): void {
        for (const key in this.data) {
            callbackfn(this.data[key], key, this);
        }
    }

}