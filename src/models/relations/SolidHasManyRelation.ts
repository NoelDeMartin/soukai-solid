import {
    Attributes,
    BelongsToManyRelation,
    BelongsToOneRelation,
    EngineDocument,
    EngineDocumentsCollection,
    EngineHelper,
    HasManyRelation,
    SoukaiError,
} from 'soukai';

import SolidModel from '@/models/SolidModel';

import RDF from '@/solid/utils/RDF';

export default class SolidHasManyRelation<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends typeof SolidModel = typeof SolidModel,
> extends HasManyRelation<Parent, Related, RelatedClass> {

    __newModels: Related[] = [];
    __modelsInSameDocument?: Related[];
    __modelsInOtherDocumentIds?: string[];

    public useSameDocument: boolean = false;

    public async resolve(): Promise<Related[]> {
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
    public async save(model: Related): Promise<void> {
        this.assertLoaded('save');
        this.add(model);

        if (!this.useSameDocument)
            await model.save();
        else if (this.parent.exists())
            await this.parent.save()
    }

    public add(model: Related): void {
        this.assertLoaded('add');

        if (this.parent.exists())
            this.initializeInverseRelations(model);

        if (!model.exists())
            this.__newModels.push(model);

        this.related!.push(model);
    }

    public usingSameDocument(useSameDocument: boolean = true): this {
        this.useSameDocument = useSameDocument;

        return this;
    }

    public async __loadDocumentModels(document: EngineDocument): Promise<void> {
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

        this.__modelsInSameDocument = await Promise.all(
            Object
                .entries(helper.filterDocuments(documents, filters))
                .map(
                    ([id, document]) =>
                        this.relatedClass.createFromEngineDocument(id, document) as Promise<Related>,
                ),
        );

        this.__modelsInOtherDocumentIds = Object.keys(documents).filter(
            resourceId => !this.__modelsInSameDocument!.some(model => model.url === resourceId),
        );

        if (this.__modelsInOtherDocumentIds.length > 0)
            return;

        this.related = this.__modelsInSameDocument;
    }

    private initializeInverseRelations(model: Related): void {
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

            if (!(relationInstance instanceof BelongsToOneRelation))
                continue;

            model.setAttribute(relationInstance.foreignKeyName, this.parent.url);
            relationInstance.related = this.parent;
        }
    }

    private assertLoaded(method: string): void {
        if (this.loaded)
            return;

        if (!this.parent.exists()) {
            this.related = [];

            return;
        }

        throw new SoukaiError(`The "${method}" method cannot be called before loading the relationship`);
    }

}
