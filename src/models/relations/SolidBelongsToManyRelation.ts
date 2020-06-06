import { BelongsToManyRelation, EngineDocument, EngineHelper, EngineDocumentsCollection } from 'soukai';

import SolidModel from '@/models/SolidModel';

import Url from '@/utils/Url';

export default class SolidBelongsToManyRelation<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends typeof SolidModel = typeof SolidModel,
> extends BelongsToManyRelation<Parent, Related, RelatedClass> {

    modelsInSameDocument?: Related[];
    modelsInOtherDocumentIds?: string[];

    public async resolve(): Promise<Related[]> {
        if (!this.modelsInSameDocument || !this.modelsInOtherDocumentIds) {
            this.modelsInSameDocument = [];
            this.modelsInOtherDocumentIds = this.parent.getAttribute(this.foreignKeyName);
        }

        const idsByContainerUrl = {};

        for (const id of this.modelsInOtherDocumentIds!) {
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
            ...this.modelsInSameDocument,
            ...modelsInOtherDocuments,
        ];

        return this.related;
    }

    public async loadDocumentModels(document: EngineDocument): Promise<void> {
        const helper = new EngineHelper();
        const modelIds = this.parent.getAttribute(this.foreignKeyName) as string[];
        const filters = this.relatedClass.prepareEngineFilters();
        const documents = (document['@graph'] as any[])
            .filter(resource => modelIds.indexOf(resource['@id']) !== -1)
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

        this.modelsInOtherDocumentIds = modelIds.filter(
            resourceId => !this.modelsInSameDocument!.find(model => model.url === resourceId),
        );

        if (this.modelsInOtherDocumentIds.length > 0)
            return;

        this.related = this.modelsInSameDocument;
    }

}
