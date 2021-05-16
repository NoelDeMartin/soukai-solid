import { EngineHelper, HasManyRelation, SoukaiError } from 'soukai';
import { tap, urlRoute } from '@noeldemartin/utils';
import type {
    Attributes,
    EngineAttributeValue,
    EngineDocument,
    EngineDocumentsCollection,
} from 'soukai';

import RDF from '@/solid/utils/RDF';
import type { JsonLDResource } from '@/solid/utils/RDF';
import type { SolidBootedFieldsDefinition } from '@/models/fields';
import type { SolidModel } from '@/models/SolidModel';
import type { SolidModelConstructor } from '@/models/inference';

import { initializeInverseRelations } from './utils';

export default class SolidHasManyRelation<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends SolidModelConstructor<Related> = SolidModelConstructor<Related>,
> extends HasManyRelation<Parent, Related, RelatedClass> {

    public useSameDocument: boolean = false;
    public __newModels: Related[] = [];
    public __modelsInSameDocument?: Related[];
    public __modelsInOtherDocumentIds?: string[];

    private documentModelsLoaded: boolean = false;

    public isEmpty(): boolean | null {
        return this.documentModelsLoaded
            ? null
            : (
                (this.__modelsInSameDocument?.length || 0) +
                (this.__modelsInOtherDocumentIds?.length || 0) +
                this.__newModels.length +
                (this.related?.length || 0)
            ) === 0;
    }

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

    /**
     * This method will create an instance of the related model and call the [[save]] method.
     *
     * @param attributes Attributes to create the related instance.
     */
    public async create(attributes: Attributes = {}): Promise<Related> {
        this.assertLoaded('create');

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
        this.assertLoaded('save');
        this.add(model);

        if (!this.useSameDocument)
            await model.save();
        else if (this.parent.exists())
            await this.parent.save();

        return model;
    }

    public add(model: Related): Related {
        if (!this.assertLoaded('add'))
            return model;

        if (this.related.includes(model) || this.__newModels.includes(model))
            return model;

        if (this.parent.exists())
            this.initializeInverseRelations(model);

        if (!model.exists())
            this.__newModels.push(model);

        this.related.push(model);

        return model;
    }

    public usingSameDocument(useSameDocument: boolean = true): this {
        this.useSameDocument = useSameDocument;

        return this;
    }

    public clone(): this {
        const clone = super.clone();
        const relatedClones = clone.related ?? [];

        clone.useSameDocument = this.useSameDocument;
        clone.documentModelsLoaded = this.documentModelsLoaded;
        clone.__newModels = [];

        for (const relatedModel of this.__newModels) {
            clone.__newModels.push(
                relatedClones.find(relatedClone => relatedClone.is(relatedModel)) ??
                tap(relatedModel.clone(), relatedClone => relatedClones.push(relatedClone)),
            );
        }

        if (this.__modelsInSameDocument)
            clone.__modelsInSameDocument = this.__modelsInSameDocument.map(relatedModel => {
                return relatedClones.find(relatedClone => relatedClone.is(relatedModel))
                    ?? relatedModel.clone();
            });

        if (this.__modelsInOtherDocumentIds)
            clone.__modelsInOtherDocumentIds = this.__modelsInOtherDocumentIds;

        return clone;
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

        const modelsInSameDocument = this.__modelsInSameDocument = await Promise.all(
            Object
                .entries(helper.filterDocuments(documents, filters))
                .map(
                    ([id, document]) =>
                        this.relatedClass.createFromEngineDocument(documentUrl, document, id) as Promise<Related>,
                ),
        );

        this.__modelsInOtherDocumentIds = Object.keys(documents).filter(
            resourceId =>
                !modelsInSameDocument.some(model => model.url === resourceId) &&
                urlRoute(resourceId) !== documentUrl,
        );

        if (this.__modelsInOtherDocumentIds.length > 0) {
            this.documentModelsLoaded = true;

            return;
        }

        this.related = this.__modelsInSameDocument.slice(0);
        this.documentModelsLoaded = true;
    }

    private initializeInverseRelations(model: Related): void {
        initializeInverseRelations(this, model);
    }

    private assertLoaded(method: string): this is { related: Related[] } {
        if (this.loaded)
            return true;

        if (!this.parent.exists()) {
            this.related = [];

            return true;
        }

        throw new SoukaiError(`The "${method}" method can't be called before loading the relationship`);
    }

}
