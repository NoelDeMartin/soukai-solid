import { Engine, Model, Database, DocumentNotFound, SoukaiError, FieldType } from 'soukai';

import SolidModel, { SolidFieldDefinition } from '@/models/SolidModel';

import Solid, { Resource, ResourceProperty } from '@/solid';

export default class SolidEngine implements Engine {

    public async create(
        model: typeof SolidModel,
        allAttributes: Database.Attributes
    ): Promise<Database.Key> {
        this.assertModelType(model);

        const { id: url, ...attributes } = allAttributes;
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

    public async readOne(model: typeof SolidModel, id: Database.Key): Promise<Database.Document> {
        this.assertModelType(model);

        const resource = await Solid.getResource(id);

        if (resource === null) {
            throw new DocumentNotFound(id);
        }

        return this.parseResourceAttributes(model, resource);
    }

    public async readMany(model: typeof SolidModel): Promise<Database.Document[]> {
        this.assertModelType(model);

        return Solid
            .getResources(model.collection, [...model.rdfsClasses])
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

    public async delete(model: typeof Model, id: Database.Key): Promise<void> {
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
    ): Database.Document {
        const document: Database.Document = {
            id: resource.url,
        };

        for (const field in model.fields) {
            const definition = model.fields[field];

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
        attributes: Database.Attributes,
    ): ResourceProperty[] {
        const properties: ResourceProperty[] = [];

        for (const field in attributes) {
            const fieldDefinition: SolidFieldDefinition = model.fields[field];
            const value = attributes[field];

            if (!fieldDefinition) {
                throw new SoukaiError(`Trying to create model with an undefined field "${field}"`);
            }

            switch (fieldDefinition.type) {
                case FieldType.Boolean:
                    properties.push(ResourceProperty.literal(fieldDefinition.rdfProperty, !!value));
                    break;
                case FieldType.Key:
                    properties.push(ResourceProperty.link(fieldDefinition.rdfProperty, value.toString()));
                    break;
                case FieldType.Number:
                    properties.push(
                        ResourceProperty.literal(
                            fieldDefinition.rdfProperty,
                            typeof value !== 'number' ? parseFloat(value.toString()) : value,
                        )
                    );
                    break;
                case FieldType.String:
                    properties.push(ResourceProperty.literal(fieldDefinition.rdfProperty, value.toString()));
                    break;
                case FieldType.Date:
                    properties.push(ResourceProperty.literal(fieldDefinition.rdfProperty, new Date(value as number * 1000)));
                    break;
                default:
                    throw new Error(
                        `Field "${field}" is of type ${fieldDefinition.type} and hasn't been implemented in SolidEngine`
                    );
            }
        }

        return properties;
    }

}