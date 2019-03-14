import { Engine, Database, Model, DocumentNotFound } from 'soukai';

import UUID from '@/utils/UUID';

export default class StubEngine implements Engine {

    public async create(
        model: typeof Model,
        attributes: Database.Attributes,
    ): Promise<Database.Key> {
        return UUID.generate();
    }

    public async readOne(
        modelDatabase: typeof Model,
        id: Database.Key,
    ): Promise<Database.Document>
    {
        throw new DocumentNotFound();
    }

    public async readMany(model: typeof Model): Promise<Database.Document[]> {
        return [];
    }

    public async update(
        model: typeof Model,
        id: Database.Key,
        dirtyAttributes: Database.Attributes,
        removedAttributes: string[],
    ): Promise<void> {
        //
    }

    public async delete(model: typeof Model, id: Database.Key): Promise<void> {

    }

}
