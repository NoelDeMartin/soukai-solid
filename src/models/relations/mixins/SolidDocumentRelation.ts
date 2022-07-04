import type { JsonLDGraph } from '@noeldemartin/solid-utils';
import type { Relation } from 'soukai';

import type { SolidModel } from '@/models/SolidModel';
import type { SolidModelConstructor } from '@/models/inference';

// Workaround for https://github.com/microsoft/TypeScript/issues/35356
export interface ISolidDocumentRelation<Related extends SolidModel = SolidModel> {
    reset(related?: Related[]): void;
    __loadDocumentModels(documentUrl: string, document: JsonLDGraph): Promise<void>;
    __beforeParentCreate(): void;
}

export type SolidDocumentRelationInstance<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends SolidModelConstructor<Related> = SolidModelConstructor<Related>,
> =
    Relation<Parent, Related, RelatedClass> &
    SolidDocumentRelation<Related> &
    ISolidDocumentRelation<Related>;

export default abstract class SolidDocumentRelation<Related extends SolidModel> {

    public useSameDocument: boolean = false;

    protected documentModelsLoaded: boolean = false;

    public usingSameDocument(useSameDocument: boolean = true): this {
        this.useSameDocument = useSameDocument;

        return this;
    }

    protected abstract loadDocumentModels(
        modelsInSameDocument: Related[],
        modelsInOtherDocumentIds: string[],
    ): void;

}
