import { Engine, Key, Attributes, Document, Model, DocumentNotFound } from 'soukai';

import UUID from '@/utils/UUID';

export default class StubEngine implements Engine {

    public async create(
        model: typeof Model,
        attributes: Attributes,
    ): Promise<Key> {
        return UUID.generate();
    }

    public async readOne(
        modelDatabase: typeof Model,
        id: Key,
    ): Promise<Document>
    {
        throw new DocumentNotFound(id);
    }

    public async readMany(model: typeof Model): Promise<Document[]> {
        return [];
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
