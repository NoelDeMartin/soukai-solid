import {
    Attributes,
    DocumentNotFound,
    Documents,
    Engine,
} from 'soukai';

import UUID from '@/utils/UUID';

export default class StubEngine implements Engine {

    private one: Attributes | null = null;
    private many: { [collection: string]: Documents } = {};

    public setOne(one: Attributes): void {
        this.one = one;
    }

    public setMany(collection: string, documents: Documents): void {
        this.many[collection] = documents;
    }

    public async create(collection: string, attributes: Attributes, id?: string): Promise<string> {
        return id || UUID.generate();
    }

    public async readOne(collection: string, id: string): Promise<Attributes>
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
        dirtyAttributes: Attributes,
        removedAttributes: string[],
    ): Promise<void> {
        //
    }

    public async delete(collection: string, id: string): Promise<void> {
        //
    }

}
