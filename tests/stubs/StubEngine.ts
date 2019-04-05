import {
    Attributes,
    Document,
    DocumentNotFound,
    Engine,
    Filters,
    Key,
    Model,
} from 'soukai';

import UUID from '@/utils/UUID';

export default class StubEngine implements Engine {

    private many: Document[] = [];

    public setMany(many: Document[]): void {
        this.many = many;
    }

    public async create(
        model: typeof Model,
        attributes: Attributes,
    ): Promise<Key> {
        return attributes[model.primaryKey] || UUID.generate();
    }

    public async readOne(
        modelDatabase: typeof Model,
        id: Key,
    ): Promise<Document>
    {
        throw new DocumentNotFound(id);
    }

    public async readMany(model: typeof Model, filters?: Filters): Promise<Document[]> {
        return this.many;
    }

    public async update(
        model: typeof Model,
        id: Key,
        dirtyAttributes: Attributes,
        removedAttributes: string[],
    ): Promise<void> {
        //
    }

    public async delete(model: typeof Model, id: Key): Promise<void> {

    }

}
