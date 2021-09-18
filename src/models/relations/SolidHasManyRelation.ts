import { HasManyRelation } from 'soukai';
import { mixedWithoutTypes, tap } from '@noeldemartin/utils';

import type { SolidModel } from '@/models/SolidModel';
import type { SolidModelConstructor } from '@/models/inference';

import SolidHasRelation from './mixins/SolidHasRelation';
import SolidMultiModelDocumentRelation from './mixins/SolidMultiModelDocumentRelation';
import type { ISolidDocumentRelation } from './mixins/SolidDocumentRelation';

export const SolidHasManyRelationBase = mixedWithoutTypes(
    HasManyRelation,
    [SolidMultiModelDocumentRelation, SolidHasRelation],
);

export default interface SolidHasManyRelation<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends SolidModelConstructor<Related> = SolidModelConstructor<Related>,
> extends SolidMultiModelDocumentRelation<Parent, Related, RelatedClass>, SolidHasRelation {}
export default class SolidHasManyRelation<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends SolidModelConstructor<Related> = SolidModelConstructor<Related>,
>
    extends SolidHasManyRelationBase<Parent, Related, RelatedClass>
    implements ISolidDocumentRelation<Related> {

    public async resolve(): Promise<Related[]> {
        if (this.isEmpty())
            return this.related = [];

        if (!this.__modelsInSameDocument || !this.__modelsInOtherDocumentIds)
            // Solid hasMany relation only finds related models that have been
            // declared in the same document.
            return this.related = [];

        const modelsInOtherDocuments = await this.relatedClass.all<Related>({
            $in: this.__modelsInOtherDocumentIds,
        });

        this.related = [
            ...this.__modelsInSameDocument,
            ...modelsInOtherDocuments,
        ];

        return this.related;
    }

    public reset(related: Related[]): void {
        related.forEach(model => {
            model.unsetAttribute(this.foreignKeyName);

            this.__newModels.push(model);
        });

        this.__modelsInSameDocument = [];
    }

    public clone(): this {
        return tap(super.clone(), clone => {
            this.cloneSolidData(clone);
        });
    }

    public __beforeParentCreate(): void {
        if (this.documentModelsLoaded)
            return;

        this.loadDocumentModels([], []);
    }

}
