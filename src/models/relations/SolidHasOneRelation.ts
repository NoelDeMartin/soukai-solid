import { HasOneRelation } from 'soukai';
import { mixedWithoutTypes, tap } from '@noeldemartin/utils';

import SolidHasRelation from '@/models/relations/mixins/SolidHasRelation';
import type { SolidModel } from '@/models/SolidModel';
import type { SolidModelConstructor } from '@/models/inference';

import SolidSingleModelDocumentRelation from './mixins/SolidSingleModelDocumentRelation';
import type { ISolidDocumentRelation } from './mixins/SolidDocumentRelation';

export const SolidHasOneRelationBase = mixedWithoutTypes(
    HasOneRelation,
    [SolidSingleModelDocumentRelation, SolidHasRelation],
);

export default interface SolidHasOneRelation<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends SolidModelConstructor<Related> = SolidModelConstructor<Related>,
> extends SolidSingleModelDocumentRelation<Parent, Related, RelatedClass>, SolidHasRelation {}
export default class SolidHasOneRelation<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends SolidModelConstructor<Related> = SolidModelConstructor<Related>,
>
    extends SolidHasOneRelationBase<Parent, Related, RelatedClass>
    implements ISolidDocumentRelation<Related> {

    public async resolve(): Promise<Related | null> {
        if (this.isEmpty())
            return this.related = null;

        if (!(this.__modelInSameDocument || this.__modelInOtherDocumentId))
            // Solid hasOne relation only finds related models that have been
            // declared in the same document.
            return null;

        const resolveModel = async (): Promise<Related | null> => {
            if (this.__modelInSameDocument)
                return this.__modelInSameDocument;

            if (this.__modelInOtherDocumentId)
                return this.relatedClass.find(this.__modelInOtherDocumentId);

            return null;
        };

        this.related = await resolveModel();

        return this.related;
    }

    public resetRemoteData(related: Related[]): void {
        if (related.length === 0)
            return;

        const model = related[0];

        model.unsetAttribute(this.foreignKeyName);

        this.__newModel = model;
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

        this.loadDocumentModels([], []);
    }

}
