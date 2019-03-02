import { Engine, Model, Database } from 'soukai';

import SolidModel from '@/models/SolidModel';

import Solid, { Resource } from '@/utils/Solid';

export default class SolidEngine implements Engine {

    public async create(
        model: typeof Model,
        attributes: Database.Attributes
    ): Promise<Database.Key> {
        // TODO
        return null as any;
    }

    public async readOne(
        model: typeof Model,
        id: Database.Key
    ): Promise<Database.Document> {
        // TODO
        return null as any;
    }

    public async readMany(model: typeof SolidModel): Promise<Database.Document[]> {
        if (!(model.prototype instanceof SolidModel)) {
            // TODO use SoukaiError
            throw new Error('SolidEngine only supports querying SolidModel models');
        }

        return Solid
            .getResources(model.collection, model.rdfsClasses)
            .then(resources => resources.map(
                resource => this.parseResourceAttributes(model, resource),
            ));
    }

    public async update(
        model: typeof Model,
        id: Database.Key,
        dirtyAttributes: Database.Attributes,
        removedAttributes: string[],
    ): Promise<void> {
        // TODO
    }

    public async delete(model: typeof Model, id: Database.Key): Promise<void> {
        // TODO
    }

    private parseResourceAttributes(
        model: typeof SolidModel,
        resource: Resource
    ): Database.Document {
        const document: Database.Document = {
            id: resource.url,
        };

        // TODO fail if required attributes are missing

        for (const field in model.fields) {
            const definition = model.fields[field];

            document[field] = Solid.getResourceAttribute(
                resource,
                definition.rdfProperty,
                undefined
            );
        }

        return document;
    }

}