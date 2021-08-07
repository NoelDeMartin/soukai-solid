import {
    arrayDiff,
    arrayFilter,
    arrayFrom,
    arraySorted,
    arrayUnique,
    arrayWithout,
    fail,
    invert,
    isPromise,
    map,
    mixed,
    objectWithout,
    objectWithoutEmpty,
    tap,
    urlParentDirectory,
    urlResolve,
    urlRoot,
    urlRoute,
    uuid,
} from '@noeldemartin/utils';
import {
    DocumentAlreadyExists,
    FieldType,
    InvalidModelDefinition,
    Model,
    ModelKey,
    SoukaiError,
    TimestampField,
    isArrayFieldDefinition,
    requireBootedModel,
} from 'soukai';
import type {
    Attributes,
    BootedFieldDefinition,
    BootedFieldsDefinition,
    EngineAttributeUpdateOperation,
    EngineAttributeValue,
    EngineDocument,
    EngineFilters,
    EngineUpdates,
    FieldsDefinition,
    IModel,
    Key,
    MagicAttributes,
    ModelConstructor,
    MultiModelRelation,
    SingleModelRelation,
    TimestampFieldValue,
} from 'soukai';
import type { Constructor } from '@noeldemartin/utils';

import { SolidEngine } from '@/engines';

import IRI from '@/solid/utils/IRI';
import RDFDocument from '@/solid/RDFDocument';
import type { JsonLD, JsonLDResource } from '@/solid/utils/RDF';
import type RDFResource from '@/solid/RDFResource';

import {
    hasBeforeParentCreateHook,
    isSolidMultiModelRelation,
    isSolidSingleModelRelation,
} from './relations/internals/guards';
import { inferFieldDefinition } from './fields';
import { SolidModelOperationType } from './SolidModelOperation';
import DeletesModels from './mixins/DeletesModels';
import SerializesToJsonLD from './mixins/SerializesToJsonLD';
import SolidBelongsToManyRelation from './relations/SolidBelongsToManyRelation';
import SolidHasManyRelation from './relations/SolidHasManyRelation';
import SolidHasOneRelation from './relations/SolidHasOneRelation';
import SolidIsContainedByRelation from './relations/SolidIsContainedByRelation';
import type { SolidModelConstructor } from './inference';
import type { SolidBootedFieldDefinition, SolidBootedFieldsDefinition, SolidFieldsDefinition } from './fields';
import type SolidContainerModel from './SolidContainerModel';
import type SolidModelMetadata from './SolidModelMetadata';
import type SolidModelOperation from './SolidModelOperation';

export class SolidModel extends mixed(Model, [DeletesModels, SerializesToJsonLD]) {

    public static primaryKey: string = 'url';

    public static fields: SolidFieldsDefinition;

    public static classFields = ['_history'];

    public static rdfContexts: Record<string, string> = {};

    public static rdfsClasses: string[] = [];

    public static defaultResourceHash: string = 'it';

    public static mintsUrls: boolean = true;

    public static history: boolean = false;

    public static from<T extends SolidModel>(
        this: SolidModelConstructor<T>,
        parentUrl: string,
    ): SolidModelConstructor<T> {
        this.collection = parentUrl;

        return this;
    }

    public static at<T extends SolidModel>(
        this: SolidModelConstructor<T>,
        parentUrl: string,
    ): SolidModelConstructor<T> {
        return this.from(parentUrl);
    }

    public static boot(name?: string): void {
        super.boot(name);

        const modelClass = this;
        const instance = modelClass.pureInstance();

        // Validate collection name.
        if (!modelClass.collection.match(/^\w+:\/\/.*\/$/))
            throw new InvalidModelDefinition(
                modelClass.name,
                'SolidModel collections must be valid container urls (ending with a trailing slash), ' +
                `'${modelClass.collection}' isn't.`,
            );

        // Expand RDF definitions.
        modelClass.rdfContexts = {
            ...modelClass.rdfContexts,
            solid: 'http://www.w3.org/ns/solid/terms#',
            rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
            rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
            ldp: 'http://www.w3.org/ns/ldp#',
            purl: 'http://purl.org/dc/terms/',
            soukai: 'https://soukai.noeldemartin.com/vocab/',
        };

        const fields = modelClass.fields as BootedFieldsDefinition<{ rdfProperty?: string }>;
        const defaultRdfContext = instance.getDefaultRdfContext();

        if (instance.hasAutomaticTimestamp(TimestampField.CreatedAt))
            delete fields[TimestampField.CreatedAt];

        if (instance.hasAutomaticTimestamp(TimestampField.UpdatedAt))
            delete fields[TimestampField.UpdatedAt];

        modelClass.rdfsClasses = arrayUnique(
            (modelClass.rdfsClasses ?? []).map(name => IRI(name, modelClass.rdfContexts, defaultRdfContext)),
        );

        if (modelClass.rdfsClasses.length === 0)
            modelClass.rdfsClasses = [defaultRdfContext + modelClass.modelName];

        for (const field in fields) {
            fields[field].rdfProperty = IRI(
                fields[field].rdfProperty ?? `${defaultRdfContext}${field}`,
                modelClass.rdfContexts,
                defaultRdfContext,
            );
        }

        delete fields[modelClass.primaryKey].rdfProperty;

        modelClass.fields = fields;
    }

    /* eslint-disable max-len */
    public static createFromEngineDocument<T extends SolidModel>(this: SolidModelConstructor<T>, id: Key, document: EngineDocument, resourceId?: string): Promise<T>;
    public static createFromEngineDocument<T extends Model>(this: ModelConstructor<T>, id: Key, document: EngineDocument): Promise<T>;
    public static createFromEngineDocument<T extends SolidModel>(this: SolidModelConstructor<T>, id: Key, document: EngineDocument, resourceId?: string): Promise<T> {
        return this.instance().createFromEngineDocument(id, document, resourceId);
    }
    /* eslint-enable max-len */

    public static async find<T extends Model>(this: ModelConstructor<T>, id: Key): Promise<T | null>;
    public static async find<T extends SolidModel>(this: SolidModelConstructor<T>, id: Key): Promise<T | null>;
    public static async find<T extends SolidModel>(this: SolidModelConstructor<T>, id: Key): Promise<T | null> {
        const resourceUrl = this.instance().serializeKey(id);
        const documentUrl = urlRoute(resourceUrl);
        const containerUrl = urlParentDirectory(documentUrl) ?? urlRoot(documentUrl);

        this.ensureBooted();

        try {
            const document = await this.requireEngine().readOne(containerUrl, documentUrl);

            return this.instance().createFromEngineDocument(documentUrl, document, resourceUrl);
        } catch (error) {
            return null;
        }
    }

    public static all<T extends Model>(this: ModelConstructor<T>, filters?: EngineFilters): Promise<T[]>;
    public static all<T extends SolidModel>(this: SolidModelConstructor<T>, filters?: EngineFilters): Promise<T[]>;
    public static all<T extends SolidModel>(this: SolidModelConstructor<T>, filters: EngineFilters = {}): Promise<T[]> {
        filters = this.prepareEngineFilters(filters);

        return this.withCollection(() => super.all(filters) as unknown as T[]);
    }

    public static prepareEngineFilters(filters: EngineFilters = {}): EngineFilters {
        // This is necessary because a SolidEngine behaves differently than other engines.
        // Even if a document is stored using compacted IRIs, a SolidEngine will need them expanded
        // because it's ultimately stored in turtle, not json-ld.
        const compactIRIs = !(this.requireEngine() instanceof SolidEngine);

        return this.instance().convertEngineFiltersToJsonLD(filters, compactIRIs);
    }

    /* eslint-disable max-len */
    public static schema<T extends SolidModel, F extends SolidFieldsDefinition>(this: SolidModelConstructor<T>, fields: F): Constructor<MagicAttributes<F>> & SolidModelConstructor<T>;
    public static schema<T extends Model, F extends FieldsDefinition>(this: ModelConstructor<T>, fields: F): Constructor<MagicAttributes<F>> & ModelConstructor<T>;
    public static schema<T extends SolidModel, F extends SolidFieldsDefinition>(this: SolidModelConstructor<T>, fields: F): Constructor<MagicAttributes<F>> & SolidModelConstructor<T> {
        return super.schema(fields) as Constructor<MagicAttributes<F>> & SolidModelConstructor<T>;
    }
    /* eslint-enable max-len */

    public static async newFromJsonLD<T extends SolidModel>(
        this: SolidModelConstructor<T>,
        jsonld: Omit<JsonLD, '@id'> & { '@id': string },
        baseUrl?: string,
    ): Promise<T> {
        const rdfDocument = await RDFDocument.fromJsonLD(jsonld);
        const flatJsonLD = await rdfDocument.toJsonLD();
        const resourceId = jsonld['@id'];
        const resource = rdfDocument.resource(resourceId);
        const documentUrl = baseUrl || urlRoute(resourceId);
        const attributes = await this.instance().parseEngineDocumentAttributes(
            documentUrl,
            flatJsonLD as EngineDocument,
            resourceId,
        );

        if (this.instance().hasAutomaticTimestamp(TimestampField.CreatedAt))
            attributes['createdAt'] = resource?.getPropertyValue(IRI('purl:created'));

        if (this.instance().hasAutomaticTimestamp(TimestampField.UpdatedAt))
            attributes['updatedAt'] = resource?.getPropertyValue(IRI('purl:modified'));

        return tap(this.newInstance(objectWithoutEmpty(attributes)), async (model) => {
            await model.loadDocumentModels(documentUrl, flatJsonLD as EngineDocument);

            model.resetEngineData();

            // TODO this should be recursive to take care of 2nd degree relations.
            for (const relationName of this.relations) {
                const relation = model._relations[relationName];
                const models = relation.getLoadedModels() as SolidModel[];

                models.forEach(model => model.resetEngineData());

                if (relation instanceof SolidHasManyRelation) {
                    models.forEach(model => {
                        delete model[relation.foreignKeyName as keyof SolidModel];
                        relation.__newModels.push(model);
                    });

                    relation.__modelsInSameDocument = [];

                    continue;
                }

                if (relation instanceof SolidHasOneRelation) {
                    if (models.length === 0)
                        continue;

                    relation.__newModel = models[0];
                    delete relation.__modelInSameDocument;

                    continue;
                }
            }
        });
    }

    protected static async withCollection<Result>(
        collection: string | undefined | (() => Result | Promise<Result>) = '',
        operation?: () => Result | Promise<Result>,
    ): Promise<Result> {
        const oldCollection = this.collection;

        if (typeof collection !== 'string') {
            operation = collection;
            collection = '';
        }

        if (!operation)
            throw new SoukaiError('Invalid method given to withCollection (SolidModel internals)');

        this.collection = collection || oldCollection;

        const result = await operation();

        this.collection = oldCollection;

        return result;
    }

    // TODO this should be optional
    public url!: string;

    public metadata!: SolidModelMetadata;
    public operations!: SolidModelOperation[];
    public relatedMetadata!: SolidHasOneRelation<this, SolidModelMetadata, SolidModelConstructor<SolidModelMetadata>>;
    public relatedOperations!:
        SolidHasManyRelation<this, SolidModelOperation, SolidModelConstructor<SolidModelOperation>>;

    protected _documentExists!: boolean;
    protected _sourceDocumentUrl!: string | null;

    private _history?: boolean;

    protected initialize(attributes: Attributes, exists: boolean): void {
        this._documentExists = exists;
        this._sourceDocumentUrl = this._sourceDocumentUrl ?? null;

        super.initialize(attributes, exists);
    }

    protected initializeRelations(): void {
        super.initializeRelations();

        this.initializeMetadataRelation();
    }

    protected initializeMetadataRelation(): void {
        const metadataModelClass = requireBootedModel<typeof SolidModelMetadata>('SolidModelMetadata');

        if (this instanceof metadataModelClass || !this.hasAutomaticTimestamps())
            return;

        const metadataRelation = this._relations.metadata as SolidHasOneRelation;
        const metadataModel = metadataModelClass.newInstance(objectWithoutEmpty({
            resourceUrl: this._attributes[this.static('primaryKey')],
            createdAt: this._attributes.createdAt,
            updatedAt: this._attributes.updatedAt,
        }), this._exists);

        metadataModel.resourceUrl && metadataModel.mintUrl(this.getDocumentUrl() || undefined, this._documentExists);
        metadataRelation.set(metadataModel);

        delete this._attributes.createdAt;
        delete this._attributes.updatedAt;
        delete this._originalAttributes.createdAt;
        delete this._originalAttributes.updatedAt;
    }

    public static(): SolidModelConstructor<this>;
    public static(property: 'fields'): SolidBootedFieldsDefinition;
    public static(property: 'timestamps'): TimestampFieldValue[];
    public static<T extends keyof SolidModelConstructor<this>>(property: T): SolidModelConstructor<this>[T];
    public static<T extends keyof SolidModelConstructor<this>>(property?: T): SolidModelConstructor<this>[T] {
        return super.static(property as keyof ModelConstructor<this>);
    }

    public save(collection?: string): Promise<this> {
        return this.static().withCollection(collection || this.guessCollection(), () => super.save());
    }

    public delete(): Promise<this> {
        return this.static().withCollection(this.guessCollection(), () => super.delete());
    }

    public mintUrl(documentUrl?: string, documentExists?: boolean, resourceHash?: string): void {
        this.setAttribute(this.static('primaryKey'), this.newUrl(documentUrl, resourceHash));

        if (documentUrl)
            this._documentExists = documentExists ?? true;
    }

    public toJsonLD(): Record<string, unknown> {
        return this.serializeToJsonLD();
    }

    public getIdAttribute(): string {
        return this.getAttribute('url');
    }

    public setExists(exists: boolean): void {
        this._documentExists = exists && this._documentExists;

        super.setExists(exists);
    }

    public documentExists(): boolean {
        return this._documentExists;
    }

    public setDocumentExists(documentExists: boolean): void {
        this._documentExists = documentExists;

        Object
            .values(this._relations)
            .filter(
                (relation): relation is SolidHasManyRelation | SolidHasOneRelation =>
                    relation instanceof SolidHasManyRelation ||
                    relation instanceof SolidHasOneRelation,
            )
            .filter(relation => relation.useSameDocument)
            .map(relation => relation.getLoadedModels())
            .flat()
            .forEach(relatedModel => relatedModel.setDocumentExists(documentExists));
    }

    public isDirty(field?: string): boolean {
        if (field)
            return super.isDirty(field);

        if (super.isDirty())
            return true;

        return this.getDirtyDocumentModels().length > 0;
    }

    public cleanDirty(): void {
        super.cleanDirty();
        this.getDirtyDocumentModels().map(model => model.cleanDirty());

        this._documentExists = true;

        Object
            .values(this._relations)
            .filter<SolidHasManyRelation>(
                (relation): relation is SolidHasManyRelation =>
                    relation instanceof SolidHasManyRelation &&
                    relation.useSameDocument,
            )
            .forEach(relation => {
                relation.__modelsInSameDocument = relation.__modelsInSameDocument || [];
                relation.__modelsInSameDocument.push(...relation.__newModels);
                relation.__newModels = [];
            });

        Object
            .values(this._relations)
            .filter<SolidHasOneRelation>(
                (relation): relation is SolidHasOneRelation =>
                    relation instanceof SolidHasOneRelation &&
                    relation.useSameDocument &&
                    !!relation.__newModel,
            )
            .forEach(relation => {
                relation.__modelInSameDocument = relation.__newModel;
                delete relation.__newModel;
            });
    }

    public tracksHistory(): boolean {
        return this._history ?? this.static('history');
    }

    public withoutTrackingHistory<T>(operation: () => T): T;
    public withoutTrackingHistory<T>(operation: () => Promise<T>): Promise<T>;
    public withoutTrackingHistory<T>(operation: () => T | Promise<T>): T | Promise<T> {
        if (!this.tracksHistory())
            return operation();

        const wasTrackingHistory = this._history;
        const restoreHistoryTracking = (): true => {
            typeof wasTrackingHistory === 'undefined'
                ? delete this._history
                : this._history = wasTrackingHistory;

            return true;
        };

        this._history = false;

        const result = operation();

        return isPromise(result)
            ? result.then(result => restoreHistoryTracking() && result)
            : restoreHistoryTracking() && result;
    }

    public rebuildAttributesFromHistory(): void {
        if (this.operations.length === 0)
            return;

        const operations = arraySorted(this.operations, 'date');
        const fields = invert(map(
            Object.keys(this.static('fields')),
            field => this.getFieldRdfProperty(field) as string,
        ));

        const filledAttributes = new Set(Object.keys(this._attributes));

        filledAttributes.delete(this.static('primaryKey'));
        filledAttributes.delete(TimestampField.CreatedAt);
        filledAttributes.delete(TimestampField.UpdatedAt);

        for (const operation of operations) {
            if (!(operation.property in fields))
                continue;

            const field = fields[operation.property];

            filledAttributes.delete(field);
            this.applyOperation(field, operation);
        }

        for (const attribute of filledAttributes) {
            this.unsetAttribute(attribute);
        }

        this.setAttribute('createdAt', operations[0].date);
        this.setAttribute('updatedAt', operations.slice(-1)[0].date);
    }

    public getDocumentUrl(): string | null {
        return this.url ? urlRoute(this.url) : null;
    }

    public requireDocumentUrl(): string {
        return this.getDocumentUrl() ?? fail(SoukaiError, 'Failed getting required document url');
    }

    public getSourceDocumentUrl(): string | null {
        return this._sourceDocumentUrl;
    }

    public getContainerUrl(): string | null {
        const documentUrl = this.getDocumentUrl();

        return documentUrl ? urlParentDirectory(documentUrl) : null;
    }

    public getSourceContainerUrl(): string | null {
        const documentUrl = this.getSourceDocumentUrl();

        return documentUrl ? urlParentDirectory(documentUrl) : null;
    }

    public getFieldDefinition(field: string, value?: unknown): SolidBootedFieldDefinition {
        return this.static('fields')[field]
            ?? inferFieldDefinition(value, this.getDefaultRdfContext() + field, false);
    }

    public getFieldRdfProperty(this: SolidModel, field: string): string | null {
        const fieldDefinition = this.static('fields')[field];

        if (fieldDefinition && !fieldDefinition.rdfProperty)
            return null;

        return fieldDefinition?.rdfProperty
            ?? this.getDefaultRdfContext() + field;
    }

    public setAttribute(field: string, value: unknown): void {
        const url = this.getPrimaryKey();

        super.setAttribute(field, value);

        if (url !== this.getPrimaryKey()) {
            const url = this.getAttribute(field);
            const documentUrl = this.getDocumentUrl() || undefined;
            const documentExists = this.documentExists();

            this.metadata?.setAttribute('resourceUrl', url);
            this.metadata?.mintUrl(documentUrl, documentExists);
            this.operations?.map(operation => {
                operation.setAttribute('resourceUrl', url);
                operation.mintUrl(documentUrl, documentExists);
            });
        }
    }

    public unsetAttribute(field: string): void {
        if (this.static('fields')?.[field]?.type === FieldType.Array)
            return this.setAttributeValue(field, []);

        return super.unsetAttribute(field);
    }

    public setCreatedAtAttribute(value: unknown): void {
        (this.metadata ?? this).setAttributeValue('createdAt', value);
    }

    public setUpdatedAtAttribute(value: unknown): void {
        (this.metadata ?? this).setAttributeValue('updatedAt', value);
    }

    public getCreatedAtAttribute(): Date {
        return this.metadata?.createdAt ?? super.getAttributeValue('createdAt');
    }

    public getUpdatedAtAttribute(): Date {
        return this.metadata?.updatedAt ?? super.getAttributeValue('updatedAt');
    }

    public metadataRelationship(): SingleModelRelation {
        const metadataModelClass = requireBootedModel<typeof SolidModelMetadata>('SolidModelMetadata');

        return this
            .hasOne(metadataModelClass, 'resourceUrl')
            .usingSameDocument(true)
            .onDelete('cascade');
    }

    public operationsRelationship(): MultiModelRelation {
        const operationModelClass = requireBootedModel<typeof SolidModelOperation>('SolidModelOperation');

        return this
            .hasMany(operationModelClass, 'resourceUrl')
            .usingSameDocument(true)
            .onDelete('cascade');
    }

    protected getDefaultCollection(): string {
        const collection = super.getDefaultCollection();

        return `solid://${collection}/`;
    }

    protected async createFromEngineDocument(
        id: Key,
        document: EngineDocument,
        resourceId?: string,
    ): Promise<this> {
        const createModel = async () => {
            const attributes = await this.parseEngineDocumentAttributes(id, document, resourceId);

            attributes[this.static('primaryKey')] = resourceId || id;

            return this.newInstance(attributes, true);
        };

        const model = await createModel();

        await model.loadDocumentModels(id, document);

        return tap(model, m => m._sourceDocumentUrl = id);
    }

    protected async createManyFromEngineDocuments(documents: Record<string, EngineDocument>): Promise<this[]> {
        const rdfsClasses = this.static('rdfsClasses');
        const models = await Promise.all(Object.entries(documents).map(async ([documentUrl, engineDocument]) => {
            const rdfDocument = await RDFDocument.fromJsonLD(engineDocument);

            return Promise.all(
                rdfDocument
                    .resources
                    .filter(
                        (resource): resource is RDFResource & { url: string } =>
                            !!resource.url &&
                            !rdfsClasses.some(rdfsClass => !resource.isType(rdfsClass)),
                    )
                    .map(async resource => this.createFromEngineDocument(
                        documentUrl,
                        engineDocument,
                        resource.url,
                    )),
            );
        }));

        return models.flat();
    }

    protected async loadDocumentModels(documentUrl: string, document: EngineDocument): Promise<void> {
        const engine = this.requireEngine();

        await Promise.all(
            Object
                .values(this._relations)
                .map(async relation => {
                    if (isSolidMultiModelRelation(relation))
                        return relation.relatedClass.withEngine(
                            engine,
                            () => relation.__loadDocumentModels(documentUrl, document),
                        );

                    if (isSolidSingleModelRelation(relation))
                        return relation.relatedClass.withEngine(
                            engine,
                            () => relation.__loadDocumentModel(documentUrl, document),
                        );
                }),
        );
    }

    protected async beforeSave(): Promise<void> {
        await super.beforeSave();

        if (!this.exists()) {
            for (const relation of Object.values(this._relations)) {
                if (!hasBeforeParentCreateHook(relation))
                    continue;

                relation.__beforeParentCreate();
            }
        }

        if (!this.url && this.static('mintsUrls'))
            this.mintUrl();

        if (this.tracksHistory() && this.exists())
            this.addHistoryOperations();
    }

    protected async duringSave(): Promise<void> {
        try {
            await super.duringSave();
        } catch (error) {
            if (!(error instanceof DocumentAlreadyExists))
                throw error;

            this.url = this.newUniqueUrl(this.url);

            await super.duringSave();
        }
    }

    protected async syncDirty(): Promise<string> {
        const documentUrl = this.getDocumentUrl();

        const createDocument = () => this.requireEngine().create(
            this.static('collection'),
            this.toEngineDocument(),
            documentUrl || undefined,
        );
        const addToDocument = () => this.requireEngine().update(
            this.static('collection'),
            documentUrl as string,
            {
                '@graph': { $push: this.serializeToJsonLD(false) as EngineDocument },
            },
        );
        const updateDocument = () => this.requireEngine().update(
            this.static('collection'),
            documentUrl as string,
            this.getDirtyEngineDocumentUpdates(),
        );
        const updateDatabase = () => {
            if (!this._documentExists)
                return createDocument();

            if (!this._exists)
                return addToDocument();

            return updateDocument();
        };

        await updateDatabase();

        return this.getSerializedPrimaryKey() as string;
    }

    protected async deleteModelsFromEngine(models: this[]): Promise<void> {
        await this.deleteModels(models);
    }

    protected addHistoryOperations(): void {
        if (this.operations.length === 0) {
            const originalAttributes = objectWithoutEmpty(
                objectWithout(this._originalAttributes, [this.static('primaryKey')]),
            );

            for (const [field, value] of Object.entries(originalAttributes)) {
                if (value === null || Array.isArray(value) && value.length === 0)
                    continue;

                this.relatedOperations.add({
                    property: this.getFieldRdfProperty(field),
                    date: this.metadata.createdAt,
                    value: this.getOperationValue(field, value),
                });
            }
        }

        for (const [field, value] of Object.entries(this._dirtyAttributes)) {
            if (Array.isArray(value)) {
                const { added, removed } = arrayDiff(this._originalAttributes[field], value);

                if (added.length > 0)
                    this.relatedOperations.add({
                        property: this.getFieldRdfProperty(field),
                        type: SolidModelOperationType.Add,
                        date: this.metadata.updatedAt,
                        value: this.getOperationValue(field, added),
                    });

                if (removed.length > 0)
                    this.relatedOperations.add({
                        property: this.getFieldRdfProperty(field),
                        type: SolidModelOperationType.Remove,
                        date: this.metadata.updatedAt,
                        value: this.getOperationValue(field, removed),
                    });

                continue;
            }

            // TODO handle unset operations

            this.relatedOperations.add({
                property: this.getFieldRdfProperty(field),
                date: this.metadata.updatedAt,
                value: this.getOperationValue(field, value),
            });
        }
    }

    /* eslint-disable max-len */
    protected hasOne<T extends typeof SolidModel>(relatedClass: T, foreignKeyField?: string, localKeyField?: string): SolidHasOneRelation;
    protected hasOne<T extends typeof Model>(relatedClass: T, foreignKeyField?: string, localKeyField?: string): SingleModelRelation;
    protected hasOne<T extends typeof Model | typeof SolidModel>(relatedClass: T, foreignKeyField?: string, localKeyField?: string): SingleModelRelation | SolidHasOneRelation {
        return new SolidHasOneRelation(this, relatedClass as typeof SolidModel, foreignKeyField, localKeyField);
    }
    /* eslint-enable max-len */

    /* eslint-disable max-len */
    protected hasMany<T extends typeof SolidModel>(relatedClass: T, foreignKeyField?: string, localKeyField?: string): SolidHasManyRelation;
    protected hasMany<T extends typeof Model>(relatedClass: T, foreignKeyField?: string, localKeyField?: string): MultiModelRelation;
    protected hasMany<T extends typeof Model | typeof SolidModel>(relatedClass: T, foreignKeyField?: string, localKeyField?: string): MultiModelRelation | SolidHasManyRelation {
        return new SolidHasManyRelation(this, relatedClass as typeof SolidModel, foreignKeyField, localKeyField);
    }
    /* eslint-enable max-len */

    /* eslint-disable max-len */
    protected belongsToMany<T extends typeof SolidModel>(relatedClass: T, foreignKeyField?: string, localKeyField?: string): SolidBelongsToManyRelation;
    protected belongsToMany<T extends typeof Model>(relatedClass: T, foreignKeyField?: string, localKeyField?: string): MultiModelRelation;
    protected belongsToMany<T extends typeof Model | typeof SolidModel>(relatedClass: T, foreignKeyField?: string, localKeyField?: string): MultiModelRelation | SolidBelongsToManyRelation {
        return new SolidBelongsToManyRelation(this, relatedClass as typeof SolidModel, foreignKeyField, localKeyField);
    }
    /* eslint-enable max-len */

    protected isContainedBy<T extends typeof SolidContainerModel>(model: T): SingleModelRelation {
        return new SolidIsContainedByRelation(this, model);
    }

    protected getDefaultRdfContext(): string {
        return Object.values(this.static('rdfContexts')).shift() || '';
    }

    protected toEngineDocument(): EngineDocument {
        return {
            '@graph': [
                this.serializeToJsonLD(false),
                ...this.prepareDirtyDocumentModels().map(model => model.serializeToJsonLD(true)),
            ],
        } as EngineDocument;
    }

    protected getDirtyEngineDocumentUpdates(): EngineUpdates {
        const graphUpdates: EngineAttributeUpdateOperation[] = [];
        const engine = this.requireEngine();
        const relatedModels = this.prepareDirtyDocumentModels();

        for (const relatedModel of relatedModels) {
            if (!relatedModel.exists()) {
                graphUpdates.push({ $push: relatedModel.serializeToJsonLD(false) as EngineAttributeValue });

                continue;
            }

            const relatedDocumentUpdates = relatedModel.withEngine(
                engine,
                model => model.getDirtyEngineDocumentUpdates(),
            ) as { '@graph': EngineAttributeUpdateOperation | { $apply: EngineAttributeUpdateOperation[] } };

            const relatedGraphUpdates = relatedDocumentUpdates['@graph'];

            '$apply' in relatedGraphUpdates
                ? graphUpdates.push(...relatedGraphUpdates.$apply)
                : graphUpdates.push(relatedGraphUpdates);
        }

        if (super.isDirty() && this.url) {
            const modelUpdates = super.getDirtyEngineDocumentUpdates();

            // This is necessary because a SolidEngine behaves differently than other engines.
            // Even if a document is stored using compacted IRIs, a SolidEngine will need them expanded
            // because it's ultimately stored in turtle, not json-ld.
            const compactIRIs = !(engine instanceof SolidEngine);

            graphUpdates.push({
                $updateItems: {
                    $where: { '@id': this.url },
                    $update: this.convertEngineUpdatesToJsonLD(modelUpdates, compactIRIs),
                },
            });
        }

        return graphUpdates.length === 1
            ? { '@graph': graphUpdates[0] }
            : { '@graph': { $apply: graphUpdates } };
    }

    protected async parseEngineDocumentAttributes(
        id: Key,
        document: EngineDocument,
        resourceId?: string,
    ): Promise<Attributes> {
        resourceId = resourceId || id as string;

        const jsonld = (document['@graph'] as EngineDocument[]).find(entity => entity['@id'] === resourceId);

        if (!jsonld)
            throw new SoukaiError(`Resource '${resourceId}' not found on document`);

        return this.convertJsonLDToAttributes(jsonld as JsonLDResource);
    }

    protected castAttribute(value: unknown, definition?: BootedFieldDefinition): unknown {
        const prepareValue = () => {
            const isNullOrUndefined = typeof value === 'undefined' || value === null;

            switch (definition?.type) {
                case FieldType.Array:
                    return isNullOrUndefined ? [] : arrayFrom(value);
                case FieldType.Any:
                    if (!Array.isArray(value))
                        return value;

                    if (value.length === 0)
                        return undefined;

                    if (value.length === 1)
                        return value[0];

                    break;
            }

            return isNullOrUndefined ? undefined : value;
        };

        return super.castAttribute(prepareValue(), definition);
    }

    protected newUrl(documentUrl?: string, resourceHash?: string): string {
        documentUrl = documentUrl ?? urlResolve(this.static('collection'), uuid());
        resourceHash = resourceHash ?? this.static('defaultResourceHash');

        return `${documentUrl}#${resourceHash}`;
    }

    protected newUniqueUrl(url?: string): string {
        url = url ?? this.newUrl();

        return `${url}-${uuid()}`;
    }

    protected guessCollection(): string | undefined {
        if (!this.url)
            return;

        return urlParentDirectory(this.url) ?? undefined;
    }

    private getDirtyDocumentModels(): SolidModel[] {
        // TODO this should be recursive to take care of 2nd degree relations.
        const documentUrl = this.getDocumentUrl();

        return Object
            .values(this._relations)
            .filter<SolidHasManyRelation | SolidHasOneRelation>(
                (relation): relation is SolidHasManyRelation | SolidHasOneRelation =>
                    relation.loaded &&
                    (relation instanceof SolidHasManyRelation || relation instanceof SolidHasOneRelation) &&
                    relation.useSameDocument,
            )
            .map(relation => {
                const models = relation instanceof SolidHasManyRelation
                    ? new Set(relation.__newModels)
                    : new Set(arrayFilter([relation.__newModel])) as Set<SolidModel>;

                for (const relatedModel of relation.getLoadedModels()) {
                    if (
                        !relatedModel.isDirty() ||
                        relatedModel.getDocumentUrl() !== documentUrl ||
                        models.has(relatedModel)
                    )
                        continue;

                    models.add(relatedModel);
                }

                models.forEach(model => model.setAttribute(relation.foreignKeyName, this.url));

                return [...models];
            })
            .flat();
    }

    private getOperationValue(field: string, value?: unknown): unknown;
    private getOperationValue(field: Omit<BootedFieldDefinition, 'required'>, value: unknown): unknown;
    private getOperationValue(field: string | Omit<BootedFieldDefinition, 'required'>, value?: unknown): unknown {
        const definition = typeof field === 'string' ? this.getFieldDefinition(field, value) : field;

        value = value ?? this.getAttributeValue(field as string);

        if (isArrayFieldDefinition(definition))
            return (value as unknown[]).map(item => this.getOperationValue(definition.items, item));

        if (definition.type === FieldType.Key)
            return new ModelKey(value);

        return value;
    }

    private applyOperation(field: string, operation: SolidModelOperation): void {
        switch (operation.type) {
            case SolidModelOperationType.Add: {
                const value = this.getAttributeValue(field);

                if (!Array.isArray(value))
                    throw new SoukaiError('Can\'t apply Add operation to non-array field');

                this.setAttributeValue(field, [...value, ...arrayFrom(operation.value)]);
                break;
            }
            case SolidModelOperationType.Remove: {
                const value = this.getAttributeValue(field);

                if (!Array.isArray(value))
                    throw new SoukaiError('Can\'t apply Remove operation to non-array field');

                const removed = this.castAttribute(
                    arrayFrom(operation.value),
                    this.getFieldDefinition(field),
                ) as typeof value;

                this.setAttributeValue(field, arrayWithout(value, removed));
                break;
            }
            case SolidModelOperationType.Unset:
                // TODO
                break;
            case SolidModelOperationType.Set:
            default:
                this.setAttributeValue(field, operation.value);
                break;
        }
    }

    private prepareDirtyDocumentModels(): SolidModel[] {
        const dirtyModels = this.getDirtyDocumentModels();

        if (dirtyModels.length === 0)
            return [];

        if (!this.url)
            this.mintUrl();

        const documentUrl = this.requireDocumentUrl();

        dirtyModels.forEach(model => !model.url && model.mintUrl(documentUrl, this._documentExists, uuid()));

        return dirtyModels;
    }

}

export interface SolidModel extends IModel<typeof SolidModel> {}
