import { Engine, Model, Database } from 'soukai';

import SolidModel from '@/models/SolidModel';

import Solid, { Resource, ResourceProperty } from '@/solid';

import Url from '@/utils/Url';
import UUID from '@/utils/UUID';

export default class SolidEngine implements Engine {

    public async create(
        model: typeof SolidModel,
        attributes: Database.Attributes
    ): Promise<Database.Key> {
        this.assertModelType(model);

        let url;
        if ('id' in attributes) {
            url = attributes.id;
            attributes = { ...attributes };
            delete attributes.id;
        } else {
            url = Url.resolve(model.collection, UUID.generate());
        }

        const properties: ResourceProperty[] = [];

        for (const field in attributes) {
            const fieldDefinition = model.fields[field];
            const value = attributes[field];

            if (!fieldDefinition) {
                // TODO throw SoukaiError
                throw new Error(`Trying to create model with an undefined field "${field}"`);
            }

            if (Array.isArray(value)) {
                // TODO implement
                throw new Error(
                    `Field "${field}" is an array and support for array fields hasn't been implemented in SolidModel`
                );
            }

            if (typeof value === 'object') {
                // TODO implement
                throw new Error(
                    `Field "${field}" is an object and support for nested fields hasn't been implemented in SolidModel`
                );
            }

            properties.push(ResourceProperty.literal(fieldDefinition.rdfProperty, value));
        }

        for (const type of model.rdfsClasses) {
            properties.push(ResourceProperty.type(type));
        }

        // TODO handle containers differently
        await Solid.createResource(url, properties);

        return url;
    }

    public async readOne(model: typeof SolidModel, id: Database.Key): Promise<Database.Document> {
        this.assertModelType(model);

        // TODO handle resource not found

        return Solid
            .getResource(id)
            .then(resource => this.parseResourceAttributes(model, resource as Resource));
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
        model: typeof SolidModel,
        id: Database.Key,
        dirtyAttributes: Database.Attributes,
        removedAttributes: string[],
    ): Promise<void> {
        this.assertModelType(model);

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

            const property = resource.getProperty(definition.rdfProperty);

            if (property !== null) {
                document[field] = property;
            }
        }

        return document;
    }

}