import {
    Attributes,
    Document,
    DocumentNotFound,
    Engine,
    FieldType,
    Key,
    Model,
    SoukaiError,
} from 'soukai';

import SolidModel, { SolidFieldDefinition } from '@/models/SolidModel';

import Solid, { Resource, ResourceProperty } from '@/solid';

export default class SolidEngine implements Engine {

    public async create(
        model: typeof SolidModel,
        allAttributes: Attributes
    ): Promise<Key> {
        this.assertModelType(model);

        const { [model.primaryKey]: url, ...attributes } = allAttributes;
        const properties = this.convertModelAttributesToResourceProperties(model, attributes);

        for (const type of model.rdfsClasses) {
            properties.push(ResourceProperty.type(type));
        }

        if (model.ldpContainer) {
            await Solid.createContainer(url as string, properties);
        } else {
            await Solid.createResource(url as string, properties);
        }

        return url as string;
    }

    public async readOne(model: typeof SolidModel, id: Key): Promise<Document> {
        this.assertModelType(model);

        const resource = await Solid.getResource(id);

        if (resource === null) {
            throw new DocumentNotFound(id);
        }

        return this.parseResourceAttributes(model, resource);
    }

    public async readMany(model: typeof SolidModel): Promise<Document[]> {
        this.assertModelType(model);

        return Solid
            .getResources(model.collection, [...model.rdfsClasses])
            .then(resources => resources.map(
                resource => this.parseResourceAttributes(model, resource),
            ));
    }

    public async update(
        model: typeof SolidModel,
        id: Key,
        dirtyAttributes: Attributes,
        removedAttributes: string[],
    ): Promise<void> {
        this.assertModelType(model);

        const updatedProperties = this.convertModelAttributesToResourceProperties(
            model,
            dirtyAttributes,
        );

        const removedProperties = removedAttributes.map(
            attribute => model.fields[attribute].rdfProperty,
        );

        try {
            await Solid.updateResource(id, updatedProperties, removedProperties);
        } catch (error) {
            // TODO this may fail for reasons other than resource not found
            throw new DocumentNotFound(id);
        }
    }

    public async delete(model: typeof Model, id: Key): Promise<void> {
        // TODO
    }

    private assertModelType(model: typeof SolidModel): void {
        if (!(model.prototype instanceof SolidModel)) {
            throw new SoukaiError('SolidEngine only supports querying SolidModel models');
        }
    }

    private parseResourceAttributes(
        model: typeof SolidModel,
        resource: Resource
    ): Document {
        const document: Document = {
            [model.primaryKey]: resource.url,
        };

        for (const field in model.fields) {
            const definition = model.fields[field];

            if (!definition || definition.rdfProperty === null) {
                continue;
            }

            const property = resource.getProperty(definition.rdfProperty);

            if (property !== null) {
                // TODO handle types
                document[field] = property as any;
            }
        }

        return document;
    }

    private convertModelAttributesToResourceProperties(
        model: typeof SolidModel,
        attributes: Attributes,
    ): ResourceProperty[] {
        const properties: ResourceProperty[] = [];

        for (const field in attributes) {
            const fieldDefinition: SolidFieldDefinition = model.fields[field];
            const value = attributes[field];

            if (!fieldDefinition) {
                throw new SoukaiError(`Trying to create model with an undefined field "${field}"`);
            }

            if (typeof fieldDefinition.rdfProperty === 'undefined') {
                continue;
            }

            switch (fieldDefinition.type) {
                case FieldType.Key:
                    properties.push(ResourceProperty.link(fieldDefinition.rdfProperty, value.toString()));
                    break;
                default:
                    properties.push(ResourceProperty.literal(fieldDefinition.rdfProperty, value));
                    break;
            }
        }

        return properties;
    }

}