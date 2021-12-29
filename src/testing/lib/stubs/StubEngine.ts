import {
    DocumentAlreadyExists,
    DocumentNotFound,
} from 'soukai';
import { urlRoute, uuid } from '@noeldemartin/utils';
import type {
    EngineDocument,
    EngineDocumentsCollection,
    EngineFilters,
    EngineUpdates,
} from 'soukai';

import { SolidEngine } from '@/engines';
import type { Fetch } from '@/engines';

export default class StubEngine extends SolidEngine {

    private one: EngineDocument | null = null;
    private many: { [collection: string]: EngineDocumentsCollection } = {};

    constructor() {
        super(null as unknown as Fetch);
    }

    public setOne(one: EngineDocument): void {
        this.one = one;
    }

    public setMany(collection: string, documents: EngineDocumentsCollection): void {
        this.many[collection] = documents;
    }

    public async create(collection: string, attributes: EngineDocument, id?: string): Promise<string> {
        if (id && this.one?.url && urlRoute(this.one.url as string) === id)
            throw new DocumentAlreadyExists(id);

        if (id && this.many && this.many[collection] && this.many[collection][id])
            throw new DocumentAlreadyExists(id);

        return id ?? uuid();
    }

    public async readOne(collection: string, id: string): Promise<EngineDocument>
    {
        if (this.one === null) {
            throw new DocumentNotFound(id);
        }

        return this.one;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async readMany(collection: string, filters?: EngineFilters): Promise<EngineDocumentsCollection> {
        return this.many[collection] || {};
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async update(collection: string, id: string, updates: EngineUpdates): Promise<void> {
        //
    }

    public async delete(): Promise<void> {
        //
    }

}
