import { SoukaiError } from 'soukai';
import { tap } from '@noeldemartin/utils';
import type { Attributes, SingleModelRelation } from 'soukai';

import type { SolidModel } from '@/models/SolidModel';
import type { SolidModelConstructor } from '@/models/inference';

import SolidDocumentRelation from './SolidDocumentRelation';

// Workaround for https://github.com/microsoft/TypeScript/issues/16936
export type This<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends SolidModelConstructor<Related> = SolidModelConstructor<Related>,
> =
    SolidSingleModelDocumentRelation<Parent, Related, RelatedClass> &
    SingleModelRelation<Parent, Related, RelatedClass>;

export type SolidSingleModelDocumentRelationInstance<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends SolidModelConstructor<Related> = SolidModelConstructor<Related>,
> = This<Parent, Related, RelatedClass>;

export default class SolidSingleModelDocumentRelation<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends SolidModelConstructor<Related> = SolidModelConstructor<Related>,
> extends SolidDocumentRelation<Related> {

    public __newModel?: Related;
    public __modelInSameDocument?: Related;
    public __modelInOtherDocumentId?: string;

    public isEmpty(this: This): boolean | null {
        if (!this.documentModelsLoaded && this.parent.exists())
            return null;

        return !(
            this.__modelInSameDocument ||
            this.__modelInOtherDocumentId ||
            this.__newModel ||
            this.related
        );
    }

    /**
     * This method will create an instance of the related model and call the [[save]] method.
     *
     * @param attributes Attributes to create the related instance.
     */
    public async create(this: This<Parent, Related, RelatedClass>, attributes: Attributes = {}): Promise<Related> {
        this.assertNotLoaded('create');

        const model = this.relatedClass.newInstance<Related>(attributes);

        await this.save(model);

        return model;
    }

    /**
     * This method will bind up all the relevant data (foreignKey, inverse relations, etc.) and save the model.
     * If the parent model does not exist and both models will be stored in the same document, the model will
     * be saved when the parent model is saved instead.
     *
     * @param model Related model instance to save.
     */
    public async save(this: This, model: Related): Promise<Related> {
        this.assertNotLoaded('save');
        this.attach(model);

        if (!this.useSameDocument)
            await model.save();
        else if (this.parent.exists())
            await this.parent.save();

        return model;
    }

    public attach(model: Related): Related;
    public attach(attributes: Attributes): Related;
    public attach(this: This<Parent, Related, RelatedClass>, modelOrAttributes: Related | Attributes): Related {
        const model = modelOrAttributes instanceof this.relatedClass
            ? modelOrAttributes as Related
            : this.relatedClass.newInstance(modelOrAttributes);

        return tap(model, () => {
            if (this.related)
                this.assertNotLoaded('set');

            if (!model.exists())
                this.__newModel = model;

            this.addRelated(model);
            this.initializeInverseRelations(model);
            this.setForeignAttributes(model);
        });
    }

    protected cloneSolidData(clone: This<Parent, Related, RelatedClass>): void {
        let relatedClone = clone.related ?? null as Related | null;

        clone.useSameDocument = this.useSameDocument;
        clone.documentModelsLoaded = this.documentModelsLoaded;

        if (this.__newModel)
            this.__newModel = relatedClone ??
                tap(this.__newModel.clone(), rClone => relatedClone = rClone);

        if (this.__modelInSameDocument)
            clone.__modelInSameDocument = relatedClone ?? this.__modelInSameDocument.clone();

        if (this.__modelInOtherDocumentId)
            clone.__modelInOtherDocumentId = this.__modelInOtherDocumentId;
    }

    protected loadDocumentModels(
        this: This<Parent, Related, RelatedClass>,
        modelsInSameDocument: Related[],
        modelsInOtherDocumentIds: string[],
    ): void {
        if (modelsInSameDocument.length + modelsInOtherDocumentIds.length > 1)
            console.warn(
                `The ${this.name} relationship in ${this.parent.static('modelName')} has been declared as hasOne, ` +
                'but more than one related model were found.',
            );

        if (modelsInSameDocument.length > 0) {
            this.__modelInSameDocument = modelsInSameDocument[0];
            this.related = this.__modelInSameDocument;
            this.documentModelsLoaded = true;

            return;
        }

        if (modelsInOtherDocumentIds.length > 0) {
            this.__modelInOtherDocumentId = modelsInOtherDocumentIds[0];
            this.documentModelsLoaded = true;

            return;
        }

        this.documentModelsLoaded = true;
    }

    private assertNotLoaded(this: This, method: string): void {
        if (this.loaded)
            throw new SoukaiError(
                `The "${method}" method can't be called because a related model already exists, ` +
                'use a hasMany relationship if you want to support multiple related models.',
            );
    }

}
