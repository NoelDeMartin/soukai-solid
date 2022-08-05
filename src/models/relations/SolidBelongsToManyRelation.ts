import {
    arrayFrom,
    arrayRemove,
    map,
    mixedWithoutTypes,
    tap,
    urlParentDirectory,
    urlRoot,
    urlRoute,
} from '@noeldemartin/utils';
import { BelongsToManyRelation, ModelKey } from 'soukai';
import type { Model, RelationCloneOptions } from 'soukai';

import { operationClasses } from '@/models/history/operations';
import type SetPropertyOperation from '@/models/history/SetPropertyOperation';
import type { SolidModel } from '@/models/SolidModel';
import type { SolidModelConstructor } from '@/models/inference';

import SolidBelongsToRelation from './mixins/SolidBelongsToRelation';
import SolidMultiModelDocumentRelation from './mixins/SolidMultiModelDocumentRelation';
import type { ISolidDocumentRelation } from './mixins/SolidDocumentRelation';

export const SolidBelongsToManyRelationBase = mixedWithoutTypes(
    BelongsToManyRelation,
    [SolidMultiModelDocumentRelation, SolidBelongsToRelation],
);

export default interface SolidBelongsToManyRelation<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends SolidModelConstructor<Related> = SolidModelConstructor<Related>,
> extends SolidMultiModelDocumentRelation<Parent, Related, RelatedClass>, SolidBelongsToRelation {}
export default class SolidBelongsToManyRelation<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends SolidModelConstructor<Related> = SolidModelConstructor<Related>,
>
    extends SolidBelongsToManyRelationBase<Parent, Related, RelatedClass>
    implements ISolidDocumentRelation<Related>
{

    public async resolve(): Promise<Related[]> {
        if (!this.__modelsInSameDocument || !this.__modelsInOtherDocumentIds) {
            this.__modelsInSameDocument = [];
            this.__modelsInOtherDocumentIds = this.parent.getAttribute(this.foreignKeyName);
        }

        if (this.isEmpty())
            return this.related = [];

        const idsByContainerUrl: Record<string, Set<string>> = {};

        for (const id of this.__modelsInOtherDocumentIds ?? []) {
            const containerUrl = urlParentDirectory(id) ?? urlRoot(id);

            if (!(containerUrl in idsByContainerUrl)) {
                idsByContainerUrl[containerUrl] = new Set;
            }

            idsByContainerUrl[containerUrl]?.add(urlRoute(id));
        }

        const results = await Promise.all(
            Object
                .entries(idsByContainerUrl)
                .map(([containerUrl, ids]) => this.relatedClass.from(containerUrl).all<Related>({ $in: [...ids] })),
        );

        const modelsInOtherDocuments = results.reduce(
            (models: Related[], containerModels: Related[]) => {
                models.push(...containerModels);

                return models;
            },
            [],
        );

        this.related = [
            ...this.__modelsInSameDocument,
            ...this.__newModels,
            ...modelsInOtherDocuments,
        ];

        return this.related;
    }

    public reset(related: Related[] = []): void {
        this.related = [];
        this.__newModels = [];
        this.__modelsInSameDocument = [];

        const foreignKeys = this.parent.getAttribute<string[]>(this.foreignKeyName);

        related.forEach(model => {
            arrayRemove(foreignKeys, model.getAttribute(this.localKeyName));

            this.related?.push(model);
            this.__newModels.push(model);
        });

        this.parent.setAttribute(this.foreignKeyName, foreignKeys);
    }

    public clone(options: RelationCloneOptions = {}): this {
        return tap(super.clone(options), clone => {
            this.cloneSolidData(clone);
        });
    }

    public __beforeParentCreate(): void {
        if (this.documentModelsLoaded)
            return;

        this.loadDocumentModels([], this.parent.getAttribute(this.foreignKeyName));
    }

    public __synchronizeRelated(other: this): void {
        const { SetPropertyOperation, AddPropertyOperation, RemovePropertyOperation } = operationClasses();
        const foreignProperty = this.parent.static().getFieldRdfProperty(this.foreignKeyName);
        const localKeyName = this.localKeyName as keyof Related;
        const thisRelatedMap = map(this.related ?? [], localKeyName);
        const otherRelatedMap = map(other.related ?? [], localKeyName);
        const clones = tap(new WeakMap<Model, Model>(), clones => clones.set(other.parent, this.parent));

        this.parent
            .operations
            .filter(
                (operation): operation is SetPropertyOperation =>
                    !operation.exists() &&
                    (
                        operation instanceof SetPropertyOperation ||
                        operation instanceof AddPropertyOperation ||
                        operation instanceof RemovePropertyOperation
                    ) &&
                    operation.property === foreignProperty,
            )
            .map(operation => arrayFrom(operation.value))
            .flat()
            .map(foreignKey => otherRelatedMap.get(foreignKey instanceof ModelKey ? foreignKey.toString() : foreignKey))
            .filter((model): model is Related => !!model)
            .forEach(model => {
                if (thisRelatedMap.hasKey(model.getAttribute(localKeyName as string)))
                    return;

                const newRelated = model.clone({ clones });

                this.related?.push(newRelated);
                thisRelatedMap.add(newRelated);
            });

        this.related = [
            ...this.parent
                .getAttribute<string[]>(this.foreignKeyName)
                .map(foreignValue => {
                    const thisRelated = thisRelatedMap.get(foreignValue);
                    const otherRelated = otherRelatedMap.get(foreignValue);

                    if (!thisRelated || !otherRelated)
                        return thisRelated;

                    thisRelated.static().synchronize(thisRelated, otherRelated);

                    return thisRelated;
                })
                .filter((model): model is Related => !!model),
            ...this.__newModels,
        ];
    }

}
