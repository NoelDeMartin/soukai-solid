import { BelongsToManyRelation, EngineDocument, EngineHelper, EngineDocumentsCollection } from 'soukai';

import SolidModel from '@/models/SolidModel';

import Url from '@/utils/Url';

export default class SolidBelongsToManyRelation<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends typeof SolidModel = typeof SolidModel,
> extends BelongsToManyRelation<Parent, Related, RelatedClass> {

    __modelsInSameDocument?: Related[];
    __modelsInOtherDocumentIds?: string[];

    public async resolve(): Promise<Related[]> {
        if (!this.__modelsInSameDocument || !this.__modelsInOtherDocumentIds) {
            this.__modelsInSameDocument = [];
            this.__modelsInOtherDocumentIds = this.parent.getAttribute(this.foreignKeyName);
        }

        const idsByContainerUrl = {};

        for (const id of this.__modelsInOtherDocumentIds!) {
            const containerUrl = Url.parentDirectory(id);

            if (!(containerUrl in idsByContainerUrl)) {
                idsByContainerUrl[containerUrl] = [];
            }

            idsByContainerUrl[containerUrl].push(id);
        }

        const results = await Promise.all(
            Object.keys(idsByContainerUrl).map(
                containerUrl => this.relatedClass.from(containerUrl).all<Related>({
                    $in: idsByContainerUrl[containerUrl],
                }),
            ),
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
            ...modelsInOtherDocuments,
        ];

        return this.related;
    }

    public async __loadDocumentModels(document: EngineDocument): Promise<void> {
        const helper = new EngineHelper();
        const modelIds = this.parent.getAttribute(this.foreignKeyName) as string[];
        const filters = this.relatedClass.prepareEngineFilters();
        const documents = (document['@graph'] as any[])
            .filter(resource => modelIds.indexOf(resource['@id']) !== -1)
            .reduce((documents, resource) => {
                documents[resource['@id']] = { '@graph': [resource] };

                return documents;
            }, {} as EngineDocumentsCollection);

        this.__modelsInSameDocument = await Promise.all(
            Object
                .entries(helper.filterDocuments(documents, filters))
                .map(
                    ([id, document]) =>
                        this.relatedClass.createFromEngineDocument(id, document) as Promise<Related>,
                ),
        );

        this.__modelsInOtherDocumentIds = modelIds.filter(
            resourceId => !this.__modelsInSameDocument!.find(model => model.url === resourceId),
        );

        if (this.__modelsInOtherDocumentIds.length > 0)
            return;

        this.related = this.__modelsInSameDocument;
    }

}
