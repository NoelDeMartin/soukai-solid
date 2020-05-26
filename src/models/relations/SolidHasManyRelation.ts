import {
    Attributes,
    BelongsToManyRelation,
    BelongsToRelation,
    EngineDocument,
    EngineDocumentsCollection,
    EngineHelper,
    HasManyRelation,
} from 'soukai';

import SolidModel from '@/models/SolidModel';

export default class SolidHasManyRelation<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends typeof SolidModel = typeof SolidModel,
> extends HasManyRelation<Parent, Related, RelatedClass> {

    public async create(attributes: Attributes = {}, useSameDocument: boolean = false): Promise<Related> {
        const model = new this.relatedClass(attributes) as Related;

        if (useSameDocument && !this.parent.url)
            this.parent.mintUrl();

        if (useSameDocument)
            model.mintUrl(this.parent.url);

        this.inititalizeInverseRelations(model);
        this.related = [...(this.related || []), model];

        if (!useSameDocument || this.parent.exists())
            await model.save();

        return model;
    }

    public async loadDocumentModels(document: EngineDocument): Promise<void> {
        // TODO filter using foreignKey: parentUrl

        const helper = new EngineHelper();
        const filters = this.relatedClass.prepareEngineFilters();
        const documents = (document['@graph'] as any[]).reduce((documents, resource) => {
            documents[resource['@id']] = { '@graph': [resource] };

            return documents;
        }, {} as EngineDocumentsCollection);

        // TODO mark as partially loaded if there are any resources outside of this document
        this.related = await Promise.all(
            Object
                .entries(helper.filterDocuments(documents, filters))
                .map(
                    ([id, document]) =>
                        this.relatedClass.createFromEngineDocument(id, document) as Promise<Related>,
                ),
        );
    }

    protected inititalizeInverseRelations(model: Related): void {
        const parentClass = this.parent.constructor;

        for (const relationName of this.relatedClass.relations) {
            const relationInstance = model.getRelation(relationName);

            if (relationInstance!.relatedClass !== parentClass)
                continue;

            if (relationInstance instanceof BelongsToManyRelation) {
                model.setAttribute(relationInstance.foreignKeyName, [this.parent.url]);
                relationInstance.related = [this.parent];

                continue;
            }

            if (!(relationInstance instanceof BelongsToRelation))
                continue;

            model.setAttribute(relationInstance.foreignKeyName, this.parent.url);
            relationInstance.related = this.parent;
        }
    }

}
