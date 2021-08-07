import { EngineHelper, HasOneRelation } from 'soukai';
import { mixedWithoutTypes, tap, urlRoute } from '@noeldemartin/utils';
import type { EngineAttributeValue, EngineDocument, EngineDocumentsCollection } from 'soukai';

import type { SolidModel } from '@/models/SolidModel';

import RDF from '@/solid/utils/RDF';
import type { JsonLDResource } from '@/solid/utils/RDF';
import type { SolidBootedFieldsDefinition } from '@/models/fields';
import type { SolidModelConstructor } from '@/models/inference';

import SolidSingleModelDocumentRelation from './mixins/SolidSingleModelDocumentRelation';
import type { ISolidSingleModelDocumentRelation } from './mixins/SolidSingleModelDocumentRelation';

export default interface SolidHasOneRelation<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends SolidModelConstructor<Related> = SolidModelConstructor<Related>,
> extends SolidSingleModelDocumentRelation<Parent, Related, RelatedClass> {}
export default class SolidHasOneRelation<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends SolidModelConstructor<Related> = SolidModelConstructor<Related>,
>
    extends mixedWithoutTypes(HasOneRelation, [SolidSingleModelDocumentRelation])<Parent, Related, RelatedClass>
    implements ISolidSingleModelDocumentRelation {

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

    public clone(): this {
        return tap(super.clone(), clone => {
            this.cloneSolidData(clone);
        });
    }

    public async __loadDocumentModel(documentUrl: string, document: EngineDocument): Promise<void> {
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

        this.loadDocumentModel(modelsInSameDocument, modelsInOtherDocumentIds);
    }

}
