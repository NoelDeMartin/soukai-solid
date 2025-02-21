import { arrayDiff, isInstanceOf, objectWithoutEmpty, requireUrlParentDirectory, tap } from '@noeldemartin/utils';
import { SoukaiError } from 'soukai';
import type { EngineAttributeUpdate, EngineAttributeUpdateOperation, EngineAttributeValueMap } from 'soukai';
import type { Nullable } from '@noeldemartin/utils';

import { defineSolidModelSchemaDecoupled } from '@/models/internals/helpers';
import { operationClass } from '@/models/history/operations';
import { CRDT_PROPERTY, CRDT_RESOURCE } from '@/solid/constants';
import type { SolidModel } from '@/models/SolidModel';
import type { SolidModelConstructor } from '@/models/inference';
import type { SolidSchemaDefinition } from '@/models/fields';

export type This = SolidModel;

export default class MigratesSchemas {

    public async migrateSchema(this: This, schema: SolidSchemaDefinition | SolidModelConstructor): Promise<void> {
        if (this.isDirty()) {
            throw new SoukaiError('Can\'t migrate dirty model, call save() before proceeding.');
        }

        const bootedSchema = this.getBootedSchema(schema);
        const graphUpdates = await this.getSchemaUpdates(bootedSchema);

        await this.updateEngineDocumentSchema(graphUpdates);
    }

    protected getBootedSchema(
        this: This,
        schema: SolidSchemaDefinition | SolidModelConstructor,
    ): SolidModelConstructor {
        const bootedSchema = Object.getPrototypeOf(schema)?.constructor === Object
            ? defineSolidModelSchemaDecoupled(schema as SolidSchemaDefinition, this.static())
            : schema as SolidModelConstructor;

        bootedSchema.ensureBooted();

        return bootedSchema;
    }

    protected async getSchemaUpdates(
        this: This,
        schema: SolidModelConstructor,
    ): Promise<EngineAttributeUpdateOperation[]> {
        const { removed: removedFields, added: addedFields } = arrayDiff(
            Object.keys(this.static().fields),
            Object.keys(schema.fields),
        );

        const model = await this.newInstanceForSchema(schema, addedFields, removedFields);
        const dirtyUrl = model.url !== this.url ? model.url : null;

        return [
            ...await this.getOperationSchemaUpdates(model, removedFields, dirtyUrl),
            ...this.getMetadataSchemaUpdates(dirtyUrl),
            ...this.getUrlSchemaUpdates(dirtyUrl),
            this.getResourceSchemaUpdate(model),
        ];
    }

    protected async newInstanceForSchema(
        this: This,
        schema: SolidModelConstructor,
        addedFields: string[],
        removedFields: string[],
    ): Promise<SolidModel> {
        const model = schema.newInstance(tap(this.getAttributes(), (attributes) => {
            attributes['url'] = `${this.requireDocumentUrl()}#${schema.defaultResourceHash}`;

            for (const removedField of removedFields) {
                delete attributes[removedField];
            }
        }), true);

        model.setRelationModels('operations', this.operations);
        addedFields.forEach(field => (model._dirtyAttributes[field] = model.getAttributeValue(field)));

        await model.static().hooks?.beforeSave?.call(model);
        await model.addDirtyHistoryOperations();

        return model;
    }

    protected async getOperationSchemaUpdates(
        this: This,
        model: SolidModel,
        removedFields: string[],
        dirtyUrl: Nullable<string>,
    ): Promise<EngineAttributeUpdateOperation[]> {
        const graphUpdates: EngineAttributeUpdateOperation[] = [];
        const PropertyOperation = operationClass('PropertyOperation');

        await model.loadRelationIfUnloaded('operations');

        for (const operation of model.operations) {
            if (!operation.exists()) {
                operation.date = this.getUpdatedAtAttribute();
                operation.resourceUrl = model.url;

                operation.mintUrl();
                graphUpdates.push({
                    $push: operation.serializeToJsonLD({
                        includeRelations: false,
                        includeAnonymousHashes: true,
                    }) as EngineAttributeValueMap,
                });

                continue;
            }

            if (!isInstanceOf(operation, PropertyOperation)) {
                if (dirtyUrl) {
                    graphUpdates.push({
                        $updateItems: {
                            $where: { '@id': operation.url },
                            $update: {
                                [CRDT_RESOURCE]: { '@id': dirtyUrl },
                            },
                        },
                    });
                }

                continue;
            }

            const field = this.static().getRdfPropertyField(operation.property);

            if (field && removedFields.includes(field)) {
                graphUpdates.push({
                    $updateItems: {
                        $where: { '@id': operation.url },
                        $unset: true,
                    },
                });

                continue;
            }

            const newProperty = field && model.static().getFieldRdfProperty(field);
            const updates = objectWithoutEmpty({
                [CRDT_RESOURCE]: dirtyUrl ? { '@id': dirtyUrl } : null,
                [CRDT_PROPERTY]: newProperty && newProperty !== operation.property ? { '@id': newProperty } : null,
            });

            if (Object.keys(updates).length === 0) {
                continue;
            }

            graphUpdates.push({
                $updateItems: {
                    $where: { '@id': operation.url },
                    $update: updates as EngineAttributeUpdate,
                },
            });
        }

        return graphUpdates;
    }

    protected getMetadataSchemaUpdates(this: This, dirtyUrl: Nullable<string>): EngineAttributeUpdateOperation[] {
        if (!dirtyUrl || !this.metadata) {
            return [];
        }

        return [
            {
                $updateItems: {
                    $where: { '@id': this.metadata.url },
                    $update: {
                        [CRDT_RESOURCE]: { '@id': dirtyUrl },
                    },
                },
            },
        ];
    }

    protected getUrlSchemaUpdates(this: This, dirtyUrl: Nullable<string>): EngineAttributeUpdateOperation[] {
        if (!dirtyUrl) {
            return [];
        }

        return [
            {
                $updateItems: {
                    $where: { '@id': this.url },
                    $update: { '@id': dirtyUrl },
                },
            },
        ];
    }

    protected getResourceSchemaUpdate(this: This, model: SolidModel): EngineAttributeUpdateOperation {
        return {
            $updateItems: {
                $where: { '@id': this.url },
                $override: model.serializeToJsonLD({
                    includeRelations: false,
                    includeAnonymousHashes: true,
                }) as EngineAttributeValueMap,
            },
        };
    }

    protected async updateEngineDocumentSchema(
        this: This,
        graphUpdates: EngineAttributeUpdateOperation[],
    ): Promise<void> {
        const documentUrl = this.requireDocumentUrl();

        await this.requireEngine().update(
            requireUrlParentDirectory(documentUrl),
            documentUrl,
            graphUpdates.length === 1
                ? { '@graph': graphUpdates[0] as EngineAttributeUpdateOperation }
                : { '@graph': { $apply: graphUpdates } },
        );
    }

}
