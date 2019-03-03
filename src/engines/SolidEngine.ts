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

    public async readOne(model: typeof SolidModel, id: Database.Key): Promise<Database.Document> {
        this.assertModelType(model);

        const url = id.startsWith('http')
            ? id
            : model.collection.endsWith('/')
                ? model.collection + id
                : model.collection + '/' + id;

        return Solid
            .getResource(url, model.rdfsClasses)
            .then(resource => this.parseResourceAttributes(model, resource));
    }

    public async readMany(model: typeof SolidModel): Promise<Database.Document[]> {
        this.assertModelType(model);

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

    private assertModelType(model: typeof SolidModel): void {
        if (!(model.prototype instanceof SolidModel)) {
            // TODO use SoukaiError
            throw new Error('SolidEngine only supports querying SolidModel models');
        }
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