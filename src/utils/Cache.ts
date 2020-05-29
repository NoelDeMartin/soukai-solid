import { Store, get, set, del, clear } from 'idb-keyval';

class Cache {

    private store: Store;

    constructor() {
        this.store = new Store('soukai-solid', 'cache');
    }

    public async get(key: string, defaultValue: any = null): Promise<any> {
        const value = await get(key, this.store);

        return value ?? defaultValue;
    }

    public set(key: string, value: any): Promise<any> {
        return set(key, value, this.store);
    }

    public delete(key: string): Promise<any> {
        return del(key, this.store);
    }

    public clear(): Promise<void> {
        return clear(this.store);
    }

}

export default new Cache();
