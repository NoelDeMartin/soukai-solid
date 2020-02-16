import {
    EngineAttributes,
    DocumentNotFound,
    Documents,
    Engine,
} from 'soukai';

import UUID from '@/utils/UUID';

export default class StubEngine implements Engine {

    private one: EngineAttributes | null = null;
    private many: { [collection: string]: Documents } = {};

    public setOne(one: EngineAttributes): void {
        this.one = one;
    }

    public setMany(collection: string, documents: Documents): void {
        this.many[collection] = documents;
    }

    public async create(collection: string, attributes: EngineAttributes, id?: string): Promise<string> {
        return id || UUID.generate();
    }

    public async readOne(collection: string, id: string): Promise<EngineAttributes>
    {
        if (this.one === null) {
            throw new DocumentNotFound(id);
        }

        return this.one;
    }

    public async readMany(collection: string): Promise<Documents> {
        return this.many[collection] || {};
    }

    public async update(
        collection: string,
        id: string,
        dirtyAttributes: EngineAttributes,
        removedAttributes: string[],
    ): Promise<void> {
        //
    }

    public async delete(collection: string, id: string): Promise<void> {
        //
    }

}
