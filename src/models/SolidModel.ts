import {
    arrayDiff,
    arrayFrom,
    arrayReplace,
    arraySorted,
    arrayUnique,
    arrayWithout,
    fail,
    invert,
    isPromise,
    map,
    md5,
    mixed,
    objectWithout,
    objectWithoutEmpty,
    requireUrlParentDirectory,
    tap,
    urlClean,
    urlParentDirectory,
    urlParse,
    urlResolve,
    urlRoot,
    urlRoute,
    uuid,
    when,
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
import { mintJsonLDIdentifiers, parseResourceSubject } from '@noeldemartin/solid-utils';
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
    Relation,
    SingleModelRelation,
    TimestampFieldValue,
} from 'soukai';
import type { Constructor } from '@noeldemartin/utils';
import type { JsonLD, JsonLDGraph, JsonLDResource, SubjectParts } from '@noeldemartin/solid-utils';

import { SolidEngine } from '@/engines';

import IRI from '@/solid/utils/IRI';
import RDFDocument from '@/solid/RDFDocument';
import type RDFResource from '@/solid/RDFResource';

import {
    hasBeforeParentCreateHook,
    isSolidDocumentRelation,
    isSolidHasRelation,
    isSolidMultiModelDocumentRelation,
    isSolidSingleModelDocumentRelation,
    synchronizesRelatedModels,
} from './relations/internals/guards';
import { inferFieldDefinition } from './fields';
import { SolidModelOperationType } from './SolidModelOperation';
import DeletesModels from './mixins/DeletesModels';
import SerializesToJsonLD from './mixins/SerializesToJsonLD';
import SolidBelongsToManyRelation from './relations/SolidBelongsToManyRelation';
import SolidBelongsToOneRelation from './relations/SolidBelongsToOneRelation';
import SolidHasManyRelation from './relations/SolidHasManyRelation';
import SolidHasOneRelation from './relations/SolidHasOneRelation';
import SolidIsContainedByRelation from './relations/SolidIsContainedByRelation';
import type SolidContainerModel from './SolidContainerModel';
import type SolidModelMetadata from './SolidModelMetadata';
import type SolidModelOperation from './SolidModelOperation';
import type { SolidBootedFieldDefinition, SolidBootedFieldsDefinition, SolidFieldsDefinition } from './fields';
import type { SolidModelConstructor } from './inference';
import type { SolidRelation } from './relations/inference';

export const SolidModelBase = mixed(Model, [DeletesModels, SerializesToJsonLD]);

export class SolidModel extends SolidModelBase {

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
        sourceJsonLD: JsonLD,
        baseUrl?: string,
    ): Promise<T> {
        baseUrl = baseUrl ?? this.collection;

        const jsonld = mintJsonLDIdentifiers(sourceJsonLD);
        const rdfDocument = await RDFDocument.fromJsonLD(jsonld, baseUrl);
        const flatJsonLD = await rdfDocument.toJsonLD();
        const resourceId = urlResolve(baseUrl, jsonld['@id']);
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

            model.reset();
            model._sourceSubject = sourceJsonLD['@id'] ? parseResourceSubject(sourceJsonLD['@id']) : {};

            // TODO this should be recursive to take care of 2nd degree relations.
            for (const relationName of this.relations) {
                const relation = model._relations[relationName];
                const models = relation.getLoadedModels() as SolidModel[];

                when(relation, isSolidDocumentRelation).reset(models);

                models.forEach(model => model.reset());
            }
        });
    }

    public static async createFromJsonLD<T extends SolidModel>(
        this: SolidModelConstructor<T>,
        jsonld: JsonLD,
        baseUrl?: string,
    ): Promise<T> {
        return tap(await this.newFromJsonLD(jsonld, baseUrl), model => model.save(baseUrl));
    }

    public static async synchronize<T extends SolidModel>(this: SolidModelConstructor<T>, a: T, b: T): Promise<void> {
        if (this !== a.static())
            return a.static().synchronize(a, b);

        if (a.getPrimaryKey() !== b.getPrimaryKey())
            throw new SoukaiError('Can\'t synchronize different models');

        await a.loadRelationIfUnloaded('operations');
        await b.loadRelationIfUnloaded('operations');

        if (a.operations.length === 0 && b.operations.length === 0)
            return;

        if (a.getHistoryHash() === b.getHistoryHash())
            return;

        a.addHistoryOperations(b.operations);
        b.addHistoryOperations(a.operations);

        for (const relation of arrayWithout(this.relations, ['metadata', 'operations'])) {
            const relationA = a.requireRelation(relation);
            const relationB = b.requireRelation(relation);

            when(relationA, synchronizesRelatedModels).__synchronizeRelated(relationB);
            when(relationB, synchronizesRelatedModels).__synchronizeRelated(relationA);
        }
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
    protected _trackedDirtyAttributes!: Attributes;
    protected _removedResourceUrls!: string[];
    declare protected _relations: Record<string, SolidRelation>;

    private _sourceSubject: SubjectParts = {};
    declare private _history?: boolean;

    protected initialize(attributes: Attributes, exists: boolean): void {
        this._documentExists = exists;
        this._sourceDocumentUrl = this._sourceDocumentUrl ?? null;
        this._trackedDirtyAttributes = {};
        this._removedResourceUrls = [];

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
        metadataRelation.attach(metadataModel);

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

    public toJsonLD(
        options: Partial<{ ids: boolean; timestamps: boolean; history: boolean}> = {},
    ): Record<string, unknown> {
        options = {
            ids: true,
            timestamps: true,
            history: true,
            ...options,
        };
        const model = this.clone();

        if (!options.ids)
            model.getRelatedModels().forEach(relatedModel => relatedModel.setAttribute('url', null));

        if (!options.timestamps)
            model.getRelatedModels().forEach(relatedModel => {
                relatedModel.relatedMetadata.related = null;
                delete relatedModel.relatedMetadata.__modelInSameDocument;
                delete relatedModel.relatedMetadata.__modelInOtherDocumentId;
                delete relatedModel.relatedMetadata.__newModel;
            });

        if (!options.history)
            model.getRelatedModels().forEach(relatedModel => {
                relatedModel.relatedOperations.related = [];
                relatedModel.relatedOperations.__newModels = [];
                delete relatedModel.relatedOperations.__modelsInSameDocument;
                delete relatedModel.relatedOperations.__modelsInOtherDocumentIds;
            });

        return model.serializeToJsonLD();
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
            .filter(isSolidDocumentRelation)
            .filter(relation => relation.useSameDocument)
            .map(relation => relation.getLoadedModels())
            .flat()
            .forEach(relatedModel => relatedModel.setDocumentExists(documentExists));
    }

    public isDirty(field?: string, ignoreRelations?: boolean): boolean {
        if (field)
            return this.static('timestamps').includes(field as TimestampFieldValue)
                ? this.metadata?.isDirty(field) || super.isDirty(field)
                : super.isDirty(field);

        if (super.isDirty())
            return true;

        return ignoreRelations
            ? false
            : this.getDocumentModels().filter(model => model.isDirty(undefined, true)).length > 0;
    }

    public cleanDirty(ignoreRelations?: boolean): void {
        super.cleanDirty();

        this._documentExists = true;
        this._trackedDirtyAttributes = {};
        this._removedResourceUrls = [];

        Object
            .values(this._relations)
            .filter(isSolidMultiModelDocumentRelation)
            .filter(relation => relation.useSameDocument)
            .forEach(relation => {
                relation.__modelsInSameDocument = relation.__modelsInSameDocument || [];
                relation.__modelsInSameDocument.push(...relation.__newModels);

                relation.__newModels = [];
            });

        Object
            .values(this._relations)
            .filter(isSolidSingleModelDocumentRelation)
            .filter(relation => relation.useSameDocument && !!relation.__newModel)
            .forEach(relation => {
                relation.__modelInSameDocument = relation.__newModel;

                delete relation.__newModel;
            });

        if (!ignoreRelations)
            this.getDocumentModels().forEach(model => model.cleanDirty(true));
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

    public getHistoryHash(): string | null {
        const relatedOperations = this.getRelatedModels().map(model => model.operations ?? []).flat();

        return relatedOperations.length === 0
            ? null
            : md5(arraySorted(relatedOperations, 'url').reduce((digest, operation) => digest + operation.url, ''));
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

        Object.entries(this.static('fields')).forEach(([name, definition]) => {
            if (definition.type !== FieldType.Array)
                return;

            this.setAttribute(name, []);
        });

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

    public requireFieldRdfProperty(field: string): string {
        return this.getFieldRdfProperty(field) ?? fail(`Couldn't get required property for rdf field '${field}'`);
    }

    public setAttribute(field: string, value: unknown): void {
        const oldPrimaryKey = this.getPrimaryKey();

        super.setAttribute(field, value);

        const primaryKey = this.getPrimaryKey();

        if (oldPrimaryKey !== primaryKey)
            this.onPrimaryKeyUpdated(primaryKey, oldPrimaryKey);
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

    public getDocumentModels(_documentModels?: Set<SolidModel>): SolidModel[] {
        const documentModels = _documentModels ?? new Set();

        if (documentModels.has(this))
            return [...documentModels];

        const documentUrl = this.getDocumentUrl();

        documentModels.add(this);

        for (const relation of Object.values(this._relations)) {
            if (!isSolidDocumentRelation(relation) || !relation.loaded || !relation.useSameDocument)
                continue;

            const relatedDocumentModels = [
                ...(
                    (isSolidSingleModelDocumentRelation(relation) && relation.__newModel)
                        ? relation.__newModel.getDocumentModels(documentModels)
                        : []
                ),
                ...(
                    isSolidMultiModelDocumentRelation(relation)
                        ? relation.__newModels.map(model => model.getDocumentModels(documentModels)).flat()
                        : []
                ),
                ...relation
                    .getLoadedModels()
                    .filter(model => model.getDocumentUrl() === documentUrl)
                    .map(model => model.getDocumentModels(documentModels))
                    .flat(),
            ];

            relatedDocumentModels.forEach(model => documentModels.add(model));
        }

        return [...documentModels];
    }

    public getDirtyDocumentModels(): SolidModel[] {
        return this.getDocumentModels().filter(model => model.isDirty());
    }

    public getRelatedModels(_relatedModels?: Set<SolidModel>): SolidModel[] {
        const relatedModels = _relatedModels ?? new Set();

        if (relatedModels.has(this))
            return [...relatedModels];

        relatedModels.add(this);

        for (const relation of Object.values(this._relations)) {
            const relationModels = [
                ...(
                    (isSolidSingleModelDocumentRelation(relation) && relation.__newModel)
                        ? relation.__newModel.getRelatedModels(relatedModels)
                        : []
                ),
                ...(
                    isSolidMultiModelDocumentRelation(relation)
                        ? relation.__newModels.map(model => model.getRelatedModels(relatedModels)).flat()
                        : []
                ),
                ...relation
                    .getLoadedModels()
                    .map(model => model.getRelatedModels(relatedModels))
                    .flat(),
            ];

            relationModels.forEach(model => relatedModels.add(model));
        }

        return [...relatedModels];
    }

    public metadataRelationship(): Relation {
        const metadataModelClass = requireBootedModel<typeof SolidModelMetadata>('SolidModelMetadata');

        return this
            .hasOne(metadataModelClass, 'resourceUrl')
            .usingSameDocument(true)
            .onDelete('cascade');
    }

    public operationsRelationship(): Relation {
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

        return tap(model, m => m._sourceDocumentUrl = urlClean(id, { fragment: false }));
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
            Object.values(this._relations).filter(isSolidDocumentRelation).map(async relation => {
                return relation.relatedClass.withEngine(
                    engine,
                    () => relation.__loadDocumentModels(documentUrl, document as JsonLDGraph),
                );
            }),
        );
    }

    protected async beforeSave(ignoreRelations?: boolean): Promise<void> {
        const wasTouched =
            this.isDirty(TimestampField.UpdatedAt) ||
            !!this.metadata?.isDirty(TimestampField.UpdatedAt);

        await super.beforeSave();

        if (!this.url && this.static('mintsUrls'))
            this.mintUrl();

        if (ignoreRelations)
            return;

        await Promise.all(this.getDirtyDocumentModels().map(async model => model.exists() || model.beforeCreate()));
        await this.beforeDocumentSave();
        await Promise.all(this.getDirtyDocumentModels().map(async model => model.exists() && model.beforeUpdate()));

        this.reconcileModelTimestamps(wasTouched);
    }

    protected async beforeDocumentSave(): Promise<void> {
        let unprocessedModels: SolidModel[] = [];
        const processedModels = new Set<SolidModel>();
        const hasUnprocessedModels = () => {
            unprocessedModels = this.getDirtyDocumentModels().filter(model => !processedModels.has(model));

            return unprocessedModels.length > 0;
        };

        while (hasUnprocessedModels()) {
            if (this.static('mintsUrls'))
                this.mintDocumentModelsKeys(unprocessedModels);

            await Promise.all(unprocessedModels.map(async model => {
                if (model !== this && model.isDirty())
                    await model.beforeSave(true);

                processedModels.add(model);
            }));
        }
    }

    protected async beforeCreate(): Promise<void> {
        for (const relation of Object.values(this._relations)) {
            if (!hasBeforeParentCreateHook(relation))
                continue;

            relation.__beforeParentCreate();
        }
    }

    protected async beforeUpdate(): Promise<void> {
        if (!this.tracksHistory())
            return;

        if (this.isDirty(undefined, true)) {
            await this.addDirtyHistoryOperations();
            await Promise.all(this.operations.map(async operation => {
                if (operation.exists())
                    return;

                await operation.beforeCreate();
                await operation.beforeSave(true);

                this.mintDocumentModelsKeys([operation]);
            }));
        }
    }

    protected async performSave(): Promise<void> {
        const dirtyDocumentModelsExisted: [SolidModel, boolean][] =
            this.getDirtyDocumentModels().map(model => [model, model.exists()]);

        try {
            await super.performSave();
        } catch (error) {
            if (!(error instanceof DocumentAlreadyExists))
                throw error;

            this.url = this.newUniqueUrl(this.url);

            await super.performSave();
        }

        dirtyDocumentModelsExisted.forEach(([model, existed]) => {
            model._wasRecentlyCreated = model._wasRecentlyCreated || !existed;
        });
    }

    protected async afterSave(ignoreRelations?: boolean): Promise<void> {
        await super.afterSave();

        if (ignoreRelations)
            return;

        await Promise.all(this.getDirtyDocumentModels().map(model => model.afterSave(true)));
    }

    protected onPrimaryKeyUpdated(value: Key | null, oldValue: Key | null): void {
        const documentUrl = this.getDocumentUrl() || undefined;
        const documentExists = this.documentExists();
        const hasRelations = Object.values(this._relations).filter(isSolidHasRelation);

        for (const relation of hasRelations) {
            relation.getLoadedModels().forEach(model => {
                const foreignValue = model.getAttribute(relation.foreignKeyName);

                model.setAttribute(
                    relation.foreignKeyName,
                    !Array.isArray(foreignValue)
                        ? value
                        : tap(
                            foreignValue.slice(0),
                            newForeignValue => arrayReplace(newForeignValue, oldValue, value),
                        ),
                );
            });
        }

        this.metadata?.mintUrl(documentUrl, documentExists);
        this.operations?.map(operation => operation.mintUrl(documentUrl, documentExists));
    }

    protected async syncDirty(): Promise<string> {
        const documentUrl = this.getDocumentUrl();

        const createDocument = () => this.requireEngine().create(
            documentUrl ? requireUrlParentDirectory(documentUrl) : this.static('collection'),
            this.toEngineDocument(),
            documentUrl || undefined,
        );
        const addToDocument = () => this.requireEngine().update(
            requireUrlParentDirectory(documentUrl as string),
            documentUrl as string,
            {
                '@graph': { $push: this.serializeToJsonLD(false) as EngineDocument },
            },
        );
        const updateDocument = () => this.requireEngine().update(
            requireUrlParentDirectory(documentUrl as string),
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

    protected async addDirtyHistoryOperations(): Promise<void> {
        await this.loadRelationIfUnloaded('operations');

        if (this.operations.length === 0) {
            const originalAttributes = objectWithoutEmpty(
                objectWithout(this._originalAttributes, [this.static('primaryKey')]),
            );

            for (const [field, value] of Object.entries(originalAttributes)) {
                if (value === null || Array.isArray(value) && value.length === 0)
                    continue;

                if (field in this._trackedDirtyAttributes && this._trackedDirtyAttributes[field] === value)
                    continue;

                this.relatedOperations.attach({
                    property: this.getFieldRdfProperty(field),
                    date: this.metadata.createdAt,
                    value: this.getOperationValue(field, value),
                });
            }
        }

        for (const [field, value] of Object.entries(this._dirtyAttributes)) {
            if (field in this._trackedDirtyAttributes && this._trackedDirtyAttributes[field] === value)
                continue;

            if (Array.isArray(value)) {
                this.addArrayHistoryOperations(field, value, this._originalAttributes[field]);

                continue;
            }

            // TODO handle unset operations

            this.relatedOperations.attach({
                property: this.getFieldRdfProperty(field),
                date: this.metadata.updatedAt,
                value: this.getOperationValue(field, value),
            });
        }
    }

    protected addHistoryOperations(operations: SolidModelOperation[]): void {
        const knownOperationUrls = new Set(this.operations.map(operation => operation.url));
        const newOperations: SolidModelOperation[] = [];
        const trackedDirtyProperties: Set<string> = new Set();
        const fieldPropertiesMap = Object
            .keys(this.static('fields'))
            .reduce((fieldProperties, field) => {
                const rdfProperty = this.getFieldRdfProperty(field);

                if (rdfProperty)
                    fieldProperties[rdfProperty] = field;

                return fieldProperties;
            }, {} as Record<string, string>);

        for (const operation of operations) {
            if (knownOperationUrls.has(operation.url))
                continue;

            const newOperation = operation.clone();

            newOperation.reset();
            newOperation.url = operation.url;

            newOperations.push(newOperation);

            if (operation.property in fieldPropertiesMap)
                trackedDirtyProperties.add(operation.property);
        }

        this.setRelationModels('operations', arraySorted([...this.operations, ...newOperations], ['date', 'url']));
        this.removeDuplicatedHistoryOperations();
        this.rebuildAttributesFromHistory();

        for (const trackedDirtyProperty of trackedDirtyProperties) {
            const field = fieldPropertiesMap[trackedDirtyProperty];

            this._trackedDirtyAttributes[field] = this._dirtyAttributes[field];
        }
    }

    protected removeDuplicatedHistoryOperations(): void {
        const inceptionProperties: string[] = [];
        const duplicatedOperationUrls: string[] = [];
        const inceptionOperations = this.operations
            .filter(operation => operation.date.getTime() === this.createdAt.getTime());
        const isNotDuplicated = (operation: SolidModelOperation): boolean =>
            !duplicatedOperationUrls.includes(operation.url);

        for (const inceptionOperation of inceptionOperations) {
            if (!inceptionProperties.includes(inceptionOperation.property)) {
                inceptionProperties.push(inceptionOperation.property);

                continue;
            }

            duplicatedOperationUrls.push(inceptionOperation.url);

            if (inceptionOperation.exists())
                this._removedResourceUrls.push(inceptionOperation.url);
        }

        this.setRelationModels('operations', this.operations.filter(isNotDuplicated));
    }

    /* eslint-disable max-len */
    protected hasOne<T extends typeof SolidModel>(relatedClass: T, foreignKeyField?: string, localKeyField?: string): SolidHasOneRelation;
    protected hasOne<T extends typeof Model>(relatedClass: T, foreignKeyField?: string, localKeyField?: string): Relation;
    protected hasOne<T extends typeof Model | typeof SolidModel>(relatedClass: T, foreignKeyField?: string, localKeyField?: string): SingleModelRelation | SolidHasOneRelation {
        return new SolidHasOneRelation(this, relatedClass as typeof SolidModel, foreignKeyField, localKeyField);
    }
    /* eslint-enable max-len */

    /* eslint-disable max-len */
    protected hasMany<T extends typeof SolidModel>(relatedClass: T, foreignKeyField?: string, localKeyField?: string): SolidHasManyRelation;
    protected hasMany<T extends typeof Model>(relatedClass: T, foreignKeyField?: string, localKeyField?: string): Relation;
    protected hasMany<T extends typeof Model | typeof SolidModel>(relatedClass: T, foreignKeyField?: string, localKeyField?: string): MultiModelRelation | SolidHasManyRelation {
        return new SolidHasManyRelation(this, relatedClass as typeof SolidModel, foreignKeyField, localKeyField);
    }
    /* eslint-enable max-len */

    /* eslint-disable max-len */
    protected belongsToOne<T extends typeof SolidModel>(relatedClass: T, foreignKeyField?: string, localKeyField?: string): SolidBelongsToOneRelation;
    protected belongsToOne<T extends typeof Model>(relatedClass: T, foreignKeyField?: string, localKeyField?: string): Relation;
    protected belongsToOne<T extends typeof Model | typeof SolidModel>(relatedClass: T, foreignKeyField?: string, localKeyField?: string): MultiModelRelation | SolidBelongsToOneRelation {
        return new SolidBelongsToOneRelation(this, relatedClass as typeof SolidModel, foreignKeyField, localKeyField);
    }
    /* eslint-enable max-len */

    /* eslint-disable max-len */
    protected belongsToMany<T extends typeof SolidModel>(relatedClass: T, foreignKeyField?: string, localKeyField?: string): SolidBelongsToManyRelation;
    protected belongsToMany<T extends typeof Model>(relatedClass: T, foreignKeyField?: string, localKeyField?: string): Relation;
    protected belongsToMany<T extends typeof Model | typeof SolidModel>(relatedClass: T, foreignKeyField?: string, localKeyField?: string): MultiModelRelation | SolidBelongsToManyRelation {
        return new SolidBelongsToManyRelation(this, relatedClass as typeof SolidModel, foreignKeyField, localKeyField);
    }
    /* eslint-enable max-len */

    protected isContainedBy<T extends typeof SolidContainerModel>(model: T): SolidIsContainedByRelation {
        return new SolidIsContainedByRelation(this, model);
    }

    protected getDefaultRdfContext(): string {
        return Object.values(this.static('rdfContexts')).shift() || '';
    }

    protected toEngineDocument(): EngineDocument {
        return {
            '@graph': [
                ...this.getDirtyDocumentModels().map(model => model.serializeToJsonLD(false)),
            ],
        } as EngineDocument;
    }

    protected getDirtyEngineDocumentUpdates(ignoreRelations?: boolean): EngineUpdates {
        const graphUpdates: EngineAttributeUpdateOperation[] = [];
        const engine = this.requireEngine();
        const documentModels = this.getDirtyDocumentModels();

        if (!ignoreRelations) {
            for (const documentModel of documentModels) {
                if (documentModel === this)
                    continue;

                if (!documentModel.exists()) {
                    graphUpdates.push({ $push: documentModel.serializeToJsonLD(false) as EngineAttributeValue });

                    continue;
                }

                const relatedDocumentUpdates = documentModel.withEngine(
                    engine,
                    model => model.getDirtyEngineDocumentUpdates(true),
                ) as { '@graph': EngineAttributeUpdateOperation | { $apply: EngineAttributeUpdateOperation[] } };

                const relatedGraphUpdates = relatedDocumentUpdates['@graph'];

                '$apply' in relatedGraphUpdates
                    ? graphUpdates.push(...relatedGraphUpdates.$apply)
                    : graphUpdates.push(relatedGraphUpdates);
            }
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

        this._removedResourceUrls.forEach(removedResourceUrl => graphUpdates.push({
            $updateItems: {
                $where: { '@id': removedResourceUrl },
                $unset: true,
            },
        }));

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
        documentUrl = documentUrl ?? urlResolve(this.static('collection'), this._sourceSubject?.documentName ?? uuid());
        resourceHash = resourceHash ?? this._sourceSubject?.resourceHash ?? this.static('defaultResourceHash');

        return `${documentUrl}#${resourceHash}`;
    }

    protected newUniqueUrl(url?: string): string {
        url = url ?? this.newUrl();

        const fragment = urlParse(url)?.fragment;
        const documentUrl = urlRoute(url);

        return `${documentUrl}-${uuid()}${fragment ? `#${fragment}` : ''}`;
    }

    protected guessCollection(): string | undefined {
        if (!this.url)
            return;

        return urlParentDirectory(this.url) ?? undefined;
    }

    protected mintDocumentModelsKeys(models: SolidModel[]): void {
        const documentUrl = this.requireDocumentUrl();
        const documentExists = this._documentExists;

        // Mint primary keys
        for (const documentModel of models) {
            if (documentModel.url)
                continue;

            documentModel.mintUrl(documentUrl, documentExists, uuid());
        }

        // Set foreign keys
        for (const documentModel of models) {
            for (const relation of Object.values(documentModel._relations)) {
                relation
                    .getLoadedModels()
                    .forEach(model => relation.setForeignAttributes(model));
            }
        }
    }

    private getOperationValue<T = unknown>(field: string): T;
    private getOperationValue<T = unknown>(field: string, value: unknown): T;
    private getOperationValue<T = unknown>(field: Omit<BootedFieldDefinition, 'required'>, value: unknown): T;
    private getOperationValue(field: string | Omit<BootedFieldDefinition, 'required'>, value?: unknown): unknown {
        const definition = typeof field === 'string' ? this.getFieldDefinition(field, value) : field;

        value = value ?? this.getAttributeValue(field as string);

        if (isArrayFieldDefinition(definition)) {
            if (!value)
                value = [];
            else if (!Array.isArray(value))
                value = [value];

            return (value as unknown[]).map(item => this.getOperationValue(definition.items, item));
        }

        if (definition.type === FieldType.Key)
            return new ModelKey(value);

        return value;
    }

    private addArrayHistoryOperations(field: string, dirtyValue: unknown, originalValue: unknown): void {
        const originalValues = this.getOperationValue<unknown[]>(field, originalValue);
        const dirtyValues = this.getOperationValue<unknown[]>(field, dirtyValue);

        const { added, removed } = arrayDiff(
            originalValues,
            dirtyValues,
            originalValues[0] instanceof ModelKey
                ? (a, b) => (a as ModelKey).equals(b as ModelKey)
                : undefined,
        );

        if (added.length > 0)
            this.relatedOperations.attach({
                property: this.getFieldRdfProperty(field),
                type: SolidModelOperationType.Add,
                date: this.metadata.updatedAt,
                value: added,
            });

        if (removed.length > 0)
            this.relatedOperations.attach({
                property: this.getFieldRdfProperty(field),
                type: SolidModelOperationType.Remove,
                date: this.metadata.updatedAt,
                value: removed,
            });
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

    private reconcileModelTimestamps(wasTouchedBeforeSaving: boolean): void {
        const operationsLength = this.operations?.length ?? 0;

        if (operationsLength > 0) {
            this.setAttribute(TimestampField.UpdatedAt, this.operations[operationsLength - 1].date);

            return;
        }

        if (wasTouchedBeforeSaving)
            return;

        const originalUpdatedAt =
            this._originalAttributes[TimestampField.UpdatedAt]
            ?? this.metadata?._originalAttributes[TimestampField.UpdatedAt];

        if (!originalUpdatedAt)
            return;

        const dirtyAttributes = Object.keys(this._dirtyAttributes);

        if (dirtyAttributes[1])
            return;

        if (dirtyAttributes[0] && dirtyAttributes[0] !== TimestampField.UpdatedAt)
            return;

        this.setAttribute(TimestampField.UpdatedAt, originalUpdatedAt);
    }

}

export interface SolidModel extends IModel<typeof SolidModel> {}
