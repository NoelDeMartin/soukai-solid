import { SoukaiError } from 'soukai';
import { tap } from '@noeldemartin/utils';
import type { Attributes, MultiModelRelation } from 'soukai';

import type { SolidModel } from '@/models/SolidModel';
import type { SolidModelConstructor } from '@/models/inference';

// Workaround for https://github.com/microsoft/TypeScript/issues/16936
type This<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends SolidModelConstructor<Related> = SolidModelConstructor<Related>,
> =
    SolidMultiModelRelation<Parent, Related, RelatedClass> &
    MultiModelRelation<Parent, Related, RelatedClass>;

// Workaround for https://github.com/microsoft/TypeScript/issues/29132
interface ProtectedThis<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends SolidModelConstructor<Related> = SolidModelConstructor<Related>,
> {
    initializeInverseRelations: MultiModelRelation<Parent, Related, RelatedClass>['initializeInverseRelations'];
}

export default class SolidMultiModelRelation<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends SolidModelConstructor<Related> = SolidModelConstructor<Related>,
> {

    public useSameDocument: boolean = false;
    public __newModels: Related[] = [];
    public __modelsInSameDocument?: Related[];
    public __modelsInOtherDocumentIds?: string[];

    protected documentModelsLoaded: boolean = false;

    private get protected(): ProtectedThis<Parent, Related, RelatedClass> {
        return this as unknown as ProtectedThis<Parent, Related, RelatedClass>;
    }

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

    public usingSameDocument(useSameDocument: boolean = true): this {
        this.useSameDocument = useSameDocument;

        return this;
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
        this.add(model);

        if (!this.useSameDocument)
            await model.save();
        else if (this.parent.exists())
            await this.parent.save();

        return model;
    }

    public add(model: Related): Related;
    public add(attributes: Attributes): Related;
    public add(this: This<Parent, Related, RelatedClass>, modelOrAttributes: Related | Attributes): Related {
        const model = modelOrAttributes instanceof this.relatedClass
            ? modelOrAttributes as Related
            : this.relatedClass.newInstance(modelOrAttributes);

        if (!this.assertLoaded('add'))
            return model;

        if (this.related.includes(model) || this.__newModels.includes(model))
            return model;

        if (this.parent.exists())
            this.protected.initializeInverseRelations(model);

        if (!model.exists())
            this.__newModels.push(model);

        this.related.push(model);

        return model;
    }

    public __beforeParentCreate(): void {
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
            this.related = this.__modelsInSameDocument.slice(0);

        this.documentModelsLoaded = true;
    }

}
