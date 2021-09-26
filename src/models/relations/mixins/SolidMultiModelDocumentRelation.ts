import { arrayUnique, tap } from '@noeldemartin/utils';
import { SoukaiError } from 'soukai';
import type { Attributes, Key, MultiModelRelation } from 'soukai';

import type { SolidModel } from '@/models/SolidModel';
import type { SolidModelConstructor } from '@/models/inference';

import SolidDocumentRelation from './SolidDocumentRelation';

// Workaround for https://github.com/microsoft/TypeScript/issues/16936
export type This<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends SolidModelConstructor<Related> = SolidModelConstructor<Related>,
> =
    SolidMultiModelDocumentRelation<Parent, Related, RelatedClass> &
    MultiModelRelation<Parent, Related, RelatedClass>;

export type SolidMultiModelDocumentRelationInstance<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends SolidModelConstructor<Related> = SolidModelConstructor<Related>,
> = This<Parent, Related, RelatedClass>;

export default class SolidMultiModelDocumentRelation<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends SolidModelConstructor<Related> = SolidModelConstructor<Related>,
> extends SolidDocumentRelation<Related> {

    public __newModels: Related[] = [];
    public __modelsInSameDocument?: Related[];
    public __modelsInOtherDocumentIds?: string[];

    public isEmpty(this: This): boolean | null {
        if (!this.documentModelsLoaded && this.parent.exists())
            return null;

        const modelsCount = (
            (this.__modelsInSameDocument?.length || 0) +
            (this.__modelsInOtherDocumentIds?.length || 0) +
            this.__newModels.length +
            (this.related?.length || 0)
        );

        return modelsCount === 0;
    }

    /**
     * This method will create an instance of the related model and call the [[save]] method.
     *
     * @param attributes Attributes to create the related instance.
     */
    public async create(this: This<Parent, Related, RelatedClass>, attributes: Attributes = {}): Promise<Related> {
        this.assertLoaded('create');

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
        this.assertLoaded('save');
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
            if (!this.assertLoaded('add') || this.related.includes(model) || this.__newModels.includes(model))
                return;

            if (!model.exists())
                this.__newModels.push(model);

            this.addRelated(model);
            this.initializeInverseRelations(model);
            this.setForeignAttributes(model);
        });
    }

    public async remove(this: This<Parent, Related, RelatedClass>, keyOrModel: Key | Related): Promise<void> {
        this.detach(keyOrModel);

        await this.parent.save();
    }

    public detach(this: This<Parent, Related, RelatedClass>, keyOrModel: string | Related): void {
        const localKey = typeof keyOrModel === 'string' ? keyOrModel : keyOrModel.getAttribute(this.localKeyName);

        this.related = this.related?.filter(model => model.getAttribute(this.localKeyName) !== localKey);
        this.__newModels = this.__newModels.filter(model => model.getAttribute(this.localKeyName) !== localKey);
        this.__modelsInSameDocument = this.__modelsInSameDocument
            ?.filter(model => model.getAttribute(this.localKeyName) !== localKey);
        this.__modelsInOtherDocumentIds =
            this.__modelsInOtherDocumentIds?.filter(id => id !== localKey);

        this.parent.setAttribute(
            this.foreignKeyName,
            this.parent.getAttribute<Key[]>(this.foreignKeyName).filter(key => key !== localKey),
        );
    }

    protected cloneSolidData(clone: This<Parent, Related, RelatedClass>): void {
        const relatedClones = clone.related ?? [];

        clone.useSameDocument = this.useSameDocument;
        clone.documentModelsLoaded = this.documentModelsLoaded;
        clone.__newModels = [];

        for (const relatedModel of this.__newModels) {
            clone.__newModels.push(
                relatedClones.find(relatedClone => relatedClone.is(relatedModel)) ??
                tap(relatedModel.clone(), relatedClone => relatedClones.push(relatedClone)),
            );
        }

        if (this.__modelsInSameDocument)
            clone.__modelsInSameDocument = this.__modelsInSameDocument.map(relatedModel => {
                return relatedClones.find(relatedClone => relatedClone.is(relatedModel))
                    ?? relatedModel.clone();
            });

        if (this.__modelsInOtherDocumentIds)
            clone.__modelsInOtherDocumentIds = this.__modelsInOtherDocumentIds;
    }

    protected loadDocumentModels(
        this: This<Parent, Related, RelatedClass>,
        modelsInSameDocument: Related[],
        modelsInOtherDocumentIds: string[],
    ): void {
        this.__modelsInSameDocument = modelsInSameDocument;
        this.__modelsInOtherDocumentIds = modelsInOtherDocumentIds;

        if (this.__modelsInOtherDocumentIds.length === 0)
            this.related = arrayUnique([
                ...this.related ?? [],
                ...this.__modelsInSameDocument.slice(0),
            ]);

        this.documentModelsLoaded = true;
    }

    private assertLoaded(this: This, method: string): this is { related: Related[] } {
        if (this.loaded)
            return true;

        if (!this.parent.exists()) {
            this.related = [];

            return true;
        }

        throw new SoukaiError(`The "${method}" method can't be called before loading the relationship`);
    }

}
