import { BelongsToManyRelation, EngineHelper } from 'soukai';
import type { EngineAttributeValue, EngineDocument , EngineDocumentsCollection } from 'soukai';

import Url from '@/utils/Url';
import type { JsonLDResource } from '@/solid/utils/RDF';
import type { SolidModel } from '@/models/SolidModel';
import type { SolidModelConstructor } from '@/models/inference';

export default class SolidBelongsToManyRelation<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends SolidModelConstructor<Related> = SolidModelConstructor<Related>,
> extends BelongsToManyRelation<Parent, Related, RelatedClass> {

    public __modelsInSameDocument?: Related[];
    public __modelsInOtherDocumentIds?: string[];

    public async resolve(): Promise<Related[]> {
        if (!this.__modelsInSameDocument || !this.__modelsInOtherDocumentIds) {
            this.__modelsInSameDocument = [];
            this.__modelsInOtherDocumentIds = this.parent.getAttribute(this.foreignKeyName);
        }

        const idsByContainerUrl: Record<string, string[]> = {};

        for (const id of this.__modelsInOtherDocumentIds ?? []) {
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

    public async __loadDocumentModels(documentUrl: string, document: EngineDocument): Promise<void> {
        const helper = new EngineHelper();
        const modelIds = this.parent.getAttribute(this.foreignKeyName) as string[];
        const filters = this.relatedClass.prepareEngineFilters();
        const documents = (document['@graph'] as JsonLDResource[])
            .filter(resource => modelIds.indexOf(resource['@id']) !== -1)
            .reduce((documents, resource) => {
                documents[resource['@id']] = { '@graph': [resource as EngineAttributeValue] };

                return documents;
            }, {} as EngineDocumentsCollection);

        const modelsInSameDocument = this.__modelsInSameDocument = await Promise.all(
            Object
                .entries(helper.filterDocuments(documents, filters))
                .map(
                    ([id, document]) =>
                        this.relatedClass.createFromEngineDocument(documentUrl, document, id) as Promise<Related>,
                ),
        );

        this.__modelsInOtherDocumentIds = modelIds.filter(
            resourceId =>
                !modelsInSameDocument.some(model => model.url === resourceId) &&
                Url.route(resourceId) !== documentUrl,
        );

        if (this.__modelsInOtherDocumentIds.length > 0)
            return;

        this.related = this.__modelsInSameDocument.slice(0);
    }

}
