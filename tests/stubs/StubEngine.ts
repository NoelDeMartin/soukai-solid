import {
    DocumentAlreadyExists,
    DocumentNotFound,
    Engine,
    EngineDocument,
    EngineDocumentsCollection,
    EngineUpdates,
} from 'soukai';

import UUID from '@/utils/UUID';

export default class StubEngine implements Engine {

    private one: EngineDocument | null = null;
    private many: { [collection: string]: EngineDocumentsCollection } = {};

    public setOne(one: EngineDocument): void {
        this.one = one;
    }

    public setMany(collection: string, documents: EngineDocumentsCollection): void {
        this.many[collection] = documents;
    }

    public async create(collection: string, attributes: EngineDocument, id?: string): Promise<string> {
        if (id && this.one && this.one.url === id)
            throw new DocumentAlreadyExists(id);

        if (id && this.many && this.many[collection] && this.many[collection][id])
            throw new DocumentAlreadyExists(id);

        return id || UUID.generate();
    }

    public async readOne(collection: string, id: string): Promise<EngineDocument>
    {
        if (this.one === null) {
            throw new DocumentNotFound(id);
        }

        return this.one;
    }

    public async readMany(collection: string): Promise<EngineDocumentsCollection> {
        return this.many[collection] || {};
    }

    public async update(collection: string, id: string, updates: EngineUpdates): Promise<void> {
        //
    }

    public async delete(collection: string, id: string): Promise<void> {
        //
    }

}
