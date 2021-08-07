import { EngineHelper, HasManyRelation } from 'soukai';
import { mixedWithoutTypes, tap, urlRoute } from '@noeldemartin/utils';
import type { EngineAttributeValue, EngineDocument, EngineDocumentsCollection } from 'soukai';

import RDF from '@/solid/utils/RDF';
import SolidMultiModelRelation from '@/models/relations/mixins/SolidMultiModelRelation';
import type { JsonLDResource } from '@/solid/utils/RDF';
import type { SolidBootedFieldsDefinition } from '@/models/fields';
import type { SolidModel } from '@/models/SolidModel';
import type { SolidModelConstructor } from '@/models/inference';

export default interface SolidHasManyRelation<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends SolidModelConstructor<Related> = SolidModelConstructor<Related>,
> extends SolidMultiModelRelation<Parent, Related, RelatedClass> {}
export default class SolidHasManyRelation<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends SolidModelConstructor<Related> = SolidModelConstructor<Related>,
> extends mixedWithoutTypes(HasManyRelation, [SolidMultiModelRelation])<Parent, Related, RelatedClass> {

    public async resolve(): Promise<Related[]> {
        if (this.isEmpty())
            return this.related = [];

        if (!this.__modelsInSameDocument || !this.__modelsInOtherDocumentIds)
            // Solid hasMany relation only finds related models that have been
            // declared in the same document.
            return [];

        const modelsInOtherDocuments = await this.relatedClass.all<Related>({
            $in: this.__modelsInOtherDocumentIds,
        });

        this.related = [
            ...this.__modelsInSameDocument,
            ...modelsInOtherDocuments,
        ];

        return this.related;
    }

    public clone(): this {
        return tap(super.clone(), clone => {
            this.cloneSolidData(clone);
        });
    }

    public async __loadDocumentModels(documentUrl: string, document: EngineDocument): Promise<void> {
        const helper = new EngineHelper();
        const foreignFields = this.relatedClass.fields as SolidBootedFieldsDefinition;
        const foreignProperty = foreignFields[this.foreignKeyName]?.rdfProperty as string;
        const filters = this.relatedClass.prepareEngineFilters();
        const documents = (document['@graph'] as JsonLDResource[])
            .filter(resource => {
                const property = RDF.getJsonLDProperty(resource, foreignProperty);

                return typeof property === 'object'
                    && property !== null
                    && '@id' in property
                    && (property as { '@id': string })['@id'] === this.parent.url;
            })
            .reduce((documents, resource) => {
                documents[resource['@id']] = { '@graph': [resource as EngineAttributeValue] };

                return documents;
            }, {} as EngineDocumentsCollection);

        const modelsInSameDocument = await Promise.all(
            Object
                .entries(helper.filterDocuments(documents, filters))
                .map(
                    ([id, document]) =>
                        this.relatedClass.createFromEngineDocument(documentUrl, document, id) as Promise<Related>,
                ),
        );

        const modelsInOtherDocumentIds = Object.keys(documents).filter(
            resourceId =>
                !modelsInSameDocument.some(model => model.url === resourceId) &&
                urlRoute(resourceId) !== documentUrl,
        );

        this.loadDocumentModels(modelsInSameDocument, modelsInOtherDocumentIds);
    }

}
