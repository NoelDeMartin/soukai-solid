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

import RDF from '@/solid/utils/RDF';

export default class SolidHasManyRelation<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends typeof SolidModel = typeof SolidModel,
> extends HasManyRelation<Parent, Related, RelatedClass> {

    modelsInSameDocument?: Related[];
    modelsInOtherDocumentIds?: string[];

    modelsToStoreInSameDocument: Related[] = [];

    public addModelToStoreInSameDocument(related: Related): void {
        this.modelsToStoreInSameDocument.push(related);
    }

    public async resolve(): Promise<Related[]> {
        if (!this.modelsInSameDocument || !this.modelsInOtherDocumentIds)
            // Solid hasMany relation only finds related models that have been
            // declared in the same document.
            return [];

        const modelsInOtherDocuments = await this.relatedClass.all<Related>({
            $in: this.modelsInOtherDocumentIds,
        });

        this.related = [
            ...this.modelsInSameDocument,
            ...modelsInOtherDocuments,
        ];

        return this.related;
    }

    /**
     * This method will create an instance of the related model and bind up all the
     * relevant data (foreignKey, inverse relations, etc.). If the parent model does not
     * exist and the same document is intended to be used, the returned model won't exist either
     * until the parent is saved.
     *
     * @param attributes Attributes to create the related instance.
     * @param useSameDocument Whether to use the same document to store the related model or not.
     */
    public async create(attributes: Attributes = {}, useSameDocument: boolean = false): Promise<Related> {
        const model = new this.relatedClass(attributes) as Related;

        this.inititalizeInverseRelations(model);
        this.related = [...(this.related || []), model];

        if (!useSameDocument)
            return model.save();

        this.modelsToStoreInSameDocument.push(model);

        if (this.parent.exists())
            await this.parent.save();

        return model;
    }

    public async loadDocumentModels(document: EngineDocument): Promise<void> {
        const helper = new EngineHelper();
        const foreignProperty = this.relatedClass.fields[this.foreignKeyName]?.rdfProperty;
        const filters = this.relatedClass.prepareEngineFilters();
        const documents = (document['@graph'] as any[])
            .filter(resource => {
                const property = RDF.getJsonLDProperty(resource, foreignProperty);

                return typeof property === 'object'
                    && '@id' in property
                    && property['@id'] === this.parent.url;
            })
            .reduce((documents, resource) => {
                documents[resource['@id']] = { '@graph': [resource] };

                return documents;
            }, {} as EngineDocumentsCollection);

        this.modelsInSameDocument = await Promise.all(
            Object
                .entries(helper.filterDocuments(documents, filters))
                .map(
                    ([id, document]) =>
                        this.relatedClass.createFromEngineDocument(id, document) as Promise<Related>,
                ),
        );

        this.modelsInOtherDocumentIds = Object.keys(documents).filter(
            resourceId => !this.modelsInSameDocument!.find(model => model.url === resourceId),
        );

        if (this.modelsInOtherDocumentIds.length > 0)
            return;

        this.related = this.modelsInSameDocument;
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
