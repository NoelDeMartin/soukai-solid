import {
    EngineHelper,
    HasOneRelation,
    SoukaiError,
} from 'soukai';
import type {
    Attributes,
    EngineAttributeValue,
    EngineDocument,
    EngineDocumentsCollection,
} from 'soukai';

import type { SolidModel } from '@/models/SolidModel';

import RDF from '@/solid/utils/RDF';
import Url from '@/utils/Url';
import type { JsonLDResource } from '@/solid/utils/RDF';
import type { SolidBootedFieldsDefinition } from '@/models/fields';
import type { SolidModelConstructor } from '@/models/inference';

import { initializeInverseRelations } from './utils';

export default class SolidHasOneRelation<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends SolidModelConstructor<Related> = SolidModelConstructor<Related>,
> extends HasOneRelation<Parent, Related, RelatedClass> {

    public __newModel?: Related;
    public __modelInSameDocument?: Related;
    public __modelInOtherDocumentId?: string;

    public useSameDocument: boolean = false;

    public async resolve(): Promise<Related | null> {
        if (!this.__modelInSameDocument || !this.__modelInOtherDocumentId)
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

    /**
     * This method will create an instance of the related model and call the [[save]] method.
     *
     * @param attributes Attributes to create the related instance.
     */
    public async create(attributes: Attributes = {}): Promise<Related> {
        this.assertNotLoaded('create');

        const model = this.relatedClass.newInstance<Related>(attributes);

        await this.save(model);

        return model;
    }

    /**
     * This method will bind up all the relevant data (foreignKey, inverse relations, etc.) and save the model.
     * If the parent model does not exist and both models will be stored in the same document, the model will
     * be saved when the parent model is saved instead.
     *
     * @param model Related model instance to save.
     */
    public async save(model: Related): Promise<Related> {
        this.assertNotLoaded('save');
        this.set(model);

        if (!this.useSameDocument)
            await model.save();
        else if (this.parent.exists())
            await this.parent.save();

        return model;
    }

    public set(model: Related): Related {
        this.assertNotLoaded('set');

        if (this.parent.exists())
            this.initializeInverseRelations(model);

        if (!model.exists())
            this.__newModel = model;

        this.related = model;

        return model;
    }

    public usingSameDocument(useSameDocument: boolean = true): this {
        this.useSameDocument = useSameDocument;

        return this;
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
                Url.route(resourceId) !== documentUrl,
        );

        if (modelsInSameDocument.length + modelsInOtherDocumentIds.length > 1)
            console.warn(
                `The ${this.name} relationship in ${this.parent.static('modelName')} has been declared as hasOne, ` +
                'but more than one related model were found.',
            );

        if (modelsInSameDocument.length > 0) {
            this.__modelInSameDocument = modelsInSameDocument[0];
            this.related = this.__modelInSameDocument;

            return;
        }

        if (modelsInOtherDocumentIds.length > 0) {
            this.__modelInOtherDocumentId = modelsInOtherDocumentIds[0];

            return;
        }
    }

    private initializeInverseRelations(model: Related): void {
        initializeInverseRelations(this, model);
    }

    private assertNotLoaded(method: string): void {
        if (this.loaded)
            throw new SoukaiError(
                `The "${method}" method can't be called because a related model already exists, ` +
                'use a hasMany relationship if you want to support multiple related models.',
            );
    }

}
