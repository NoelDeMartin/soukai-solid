import { BelongsToOneRelation } from 'soukai';
import { mixedWithoutTypes, tap } from '@noeldemartin/utils';

import type { SolidModel } from '@/models/SolidModel';
import type { SolidModelConstructor } from '@/models/inference';

import SolidBelongsToRelation from './mixins/SolidBelongsToRelation';
import SolidSingleModelDocumentRelation from './mixins/SolidSingleModelDocumentRelation';
import type { ISolidDocumentRelation } from './mixins/SolidDocumentRelation';

export const SolidBelongsToOneRelationBase = mixedWithoutTypes(
    BelongsToOneRelation,
    [SolidSingleModelDocumentRelation, SolidBelongsToRelation],
);

export default interface SolidBelongsToOneRelation<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends SolidModelConstructor<Related> = SolidModelConstructor<Related>,
> extends SolidSingleModelDocumentRelation<Parent, Related, RelatedClass>, SolidBelongsToRelation {}
export default class SolidBelongsToOneRelation<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends SolidModelConstructor<Related> = SolidModelConstructor<Related>,
>
    extends SolidBelongsToOneRelationBase<Parent, Related, RelatedClass>
    implements ISolidDocumentRelation<Related>
{

    public async resolve(): Promise<Related | null> {
        if (this.__modelInSameDocument)
            return this.related = this.__modelInSameDocument;

        const foreignKey = this.__modelInOtherDocumentId ?? this.parent.getAttribute(this.foreignKeyName);

        if (!foreignKey)
            return this.related = null;

        const related = await this.relatedClass.find(foreignKey);

        return this.related = related;
    }

    public reset(related: Related[]): void {
        if (related.length === 0)
            return;

        this.parent.unsetAttribute(this.foreignKeyName);

        this.__newModel = related[0];
        delete this.__modelInSameDocument;
    }

    public clone(): this {
        return tap(super.clone(), clone => {
            this.cloneSolidData(clone);
        });
    }

    public __beforeParentCreate(): void {
        if (this.documentModelsLoaded)
            return;

        const foreignValue = this.parent.getAttribute<string>(this.foreignKeyName);

        this.loadDocumentModels([], foreignValue ? [foreignValue] : []);
    }

}
