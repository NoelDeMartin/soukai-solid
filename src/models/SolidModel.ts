import {
    arrayDiff,
    arrayFilter,
    arrayFrom,
    arrayReplace,
    arraySorted,
    arrayUnique,
    arrayWithout,
    assert,
    fail,
    invert,
    isPromise,
    map,
    md5,
    mixed,
    objectWithout,
    objectWithoutEmpty,
    requireUrlParentDirectory,
    shortId,
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
import {
    expandIRI,
    jsonldToQuads,
    mintJsonLDIdentifiers,
    parseResourceSubject,
    quadsToTurtle,
} from '@noeldemartin/solid-utils';
import type {
    Attributes,
    BootedFieldsDefinition,
    EngineAttributeUpdateOperation,
    EngineAttributeValue,
    EngineDocument,
    EngineFilters,
    EngineUpdates,
    Key,
    ModelCastAttributeOptions,
    ModelConstructor,
    MultiModelRelation,
    Relation,
    SingleModelRelation,
    TimestampFieldValue,
} from 'soukai';
import type { Fetch, JsonLD, JsonLDGraph, SubjectParts } from '@noeldemartin/solid-utils';
import type { Quad } from 'rdf-js';

import { SolidEngine } from '@/engines';

import IRI from '@/solid/utils/IRI';
import RDFDocument from '@/solid/RDFDocument';
import type RDFResource from '@/solid/RDFResource';

import {
    hasBeforeParentCreateHook,
    isSolidDocumentRelation,
    isSolidHasRelation,
    synchronizesRelatedModels,
} from './relations/guards';
import {
    isSolidMultiModelDocumentRelation,
    isSolidSingleModelDocumentRelation,
} from './relations/cardinality-guards';
import DeletesModels from './mixins/DeletesModels';
import ManagesPermissions from './mixins/ManagesPermissions';
import OperationsRelation from './relations/OperationsRelation';
import SerializesToJsonLD from './mixins/SerializesToJsonLD';
import SolidACLAuthorizationsRelation from './relations/SolidACLAuthorizationsRelation';
import SolidBelongsToManyRelation from './relations/SolidBelongsToManyRelation';
import SolidBelongsToOneRelation from './relations/SolidBelongsToOneRelation';
import SolidHasManyRelation from './relations/SolidHasManyRelation';
import SolidHasOneRelation from './relations/SolidHasOneRelation';
import SolidIsContainedByRelation from './relations/SolidIsContainedByRelation';
import TombstoneRelation from '@/models/relations/TombstoneRelation';
import { inferFieldDefinition, isSolidArrayFieldDefinition } from './fields';
import { operationClass } from './history/operations';
import type Metadata from './history/Metadata';
import type Operation from './history/Operation';
import type SolidACLAuthorization from './SolidACLAuthorization';
import type SolidDocument from './SolidDocument';
import type SolidContainer from './SolidContainer';
import type Tombstone from './history/Tombstone';
import type { SolidBootedFieldDefinition, SolidBootedFieldsDefinition, SolidFieldsDefinition } from './fields';
import type { SolidDocumentRelationInstance } from './relations/mixins/SolidDocumentRelation';
import type { SolidModelConstructor } from './inference';
import type { SolidRelation } from './relations/inference';

export const SolidModelBase = mixed(Model, [DeletesModels, SerializesToJsonLD, ManagesPermissions]);

export interface SolidModelSerializationOptions {
    ids?: boolean;
    timestamps?: boolean;
    history?: boolean;
}

export class SolidModel extends SolidModelBase {

    public static primaryKey: string = 'url';
    public static fields: SolidFieldsDefinition;
    public static classFields = ['_history', '_publicPermissions', '_tombstone'];
    public static rdfContext?: string;
    public static rdfContexts: Record<string, string> = {};
    public static rdfsClass?: string;
    public static rdfsClasses: string[] = [];
    public static rdfsClassesAliases: string[][] = [];
    public static reservedRelations: string[] = ['metadata', 'operations', 'tombstone', 'authorizations'];
    public static defaultResourceHash: string = 'it';
    public static mintsUrls: boolean = true;
    public static history: boolean = false;
    public static tombstone: boolean = true;

    protected static rdfPropertyFields?: Record<string, string>;
    protected static historyDisabled: WeakMap<SolidModel, void> = new WeakMap;

    public static getFieldDefinition(field: string, value?: unknown): SolidBootedFieldDefinition {
        if (field.endsWith('.*')) {
            const parentDefinition = this.getFieldDefinition(
                field.slice(0, -2),
                Array.isArray(value) && value.length > 0 ? value[0] : undefined,
            );

            if (!isSolidArrayFieldDefinition(parentDefinition)) {
                throw new SoukaiError('Can\'t get item field definition for non-array field');
            }

            return {
                type: parentDefinition.items.type,
                rdfProperty: parentDefinition.rdfProperty,
                rdfPropertyAliases: parentDefinition.rdfPropertyAliases,
                required: false,
            };
        }

        return (this.fields as SolidBootedFieldsDefinition)[field]
            ?? inferFieldDefinition(
                value,
                this.getDefaultRdfContext() + field,
                [],
                false,
            );
    }

    public static getFieldRdfProperty(field: string): string | null {
        const fieldDefinition = (this.fields as SolidBootedFieldsDefinition)[field];

        if (fieldDefinition && !fieldDefinition.rdfProperty)
            return null;

        return fieldDefinition?.rdfProperty
            ?? this.getDefaultRdfContext() + field;
    }

    public static getRdfPropertyField(rdfProperty: string): string | null {
        const fields = this.rdfPropertyFields ??= invert(map(
            Object.keys(this.fields),
            field => this.getFieldRdfProperty(field) as string,
        ));

        return fields[rdfProperty] ?? null;
    }

    public static requireFetch(): Fetch {
        const engine = this.requireFinalEngine();

        if (!(engine instanceof SolidEngine)) {
            throw new SoukaiError(`Could not get fetch from ${this.modelName} model`);
        }

        return engine.getFetch();
    }

    public static requireFieldRdfProperty(field: string): string {
        return this.getFieldRdfProperty(field) ?? fail(`Couldn't get required property for rdf field '${field}'`);
    }

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

        // Validate collection name.
        if (!modelClass.collection.match(/^\w+:\/\/.*\/$/)) {
            throw new InvalidModelDefinition(
                modelClass.name,
                'SolidModel collections must be valid container urls (ending with a trailing slash), ' +
                `'${modelClass.collection}' isn't.`,
            );
        }

        // Expand RDF definitions.
        modelClass.rdfContexts = this.bootRdfContexts();
        modelClass.rdfsClasses = this.bootRdfsClasses();
        modelClass.rdfsClassesAliases = modelClass.rdfsClassesAliases.map(rdfsClasses => arrayUnique(
            rdfsClasses.map(name => IRI(name, modelClass.rdfContexts, modelClass.getDefaultRdfContext())) ?? [],
        ));
        modelClass.fields = this.bootFields();
    }

    public static aliasRdfPrefixes(aliases: Record<string, string>): void {
        this.ensureBooted();

        for (const [original, alias] of Object.entries(aliases)) {
            const rdfsClassesAliases = this.rdfsClasses.reduce((rdfsClassesAliases, rdfsClass) => {
                if (rdfsClass.startsWith(original)) {
                    rdfsClassesAliases.push(rdfsClass.replace(original, alias));
                }

                return rdfsClassesAliases;
            }, [] as string[]);

            if (rdfsClassesAliases.length > 0) {
                this.rdfsClassesAliases.push(rdfsClassesAliases);
            }

            for (const field of Object.values(this.fields as SolidBootedFieldsDefinition)) {
                if (!field.rdfProperty?.startsWith(original)) {
                    continue;
                }

                field.rdfPropertyAliases.push(field.rdfProperty.replace(original, alias));
            }
        }
    }

    public static resetRdfAliases(): void {
        this.rdfsClassesAliases = [];

        for (const field of Object.values(this.fields as SolidBootedFieldsDefinition)) {
            if (!field.rdfPropertyAliases) {
                continue;
            }

            field.rdfPropertyAliases = [];
        }
    }

    public static replaceRdfPrefixes(replacements: Record<string, string>): void {
        this.ensureBooted();

        for (const [original, replacement] of Object.entries(replacements)) {
            this.rdfsClasses = this.rdfsClasses.map(rdfsClass => rdfsClass.replace(original, replacement));

            for (const field of Object.values(this.fields as SolidBootedFieldsDefinition)) {
                if (!field.rdfProperty?.startsWith(original)) {
                    continue;
                }

                field.rdfProperty = field.rdfProperty.replace(original, replacement);
            }
        }
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
            const { documentPermissions, stopTracking } = this.instance().trackPublicPermissions();
            const document = await this.requireEngine().readOne(containerUrl, documentUrl);
            const model = await this.instance().createFromEngineDocument(documentUrl, document, resourceUrl);

            stopTracking();

            model._publicPermissions = documentPermissions[documentUrl];

            return model;
        } catch (error) {
            return null;
        }
    }

    /* eslint-disable max-len */
    public static async all<T extends Model>(this: ModelConstructor<T>, filters?: EngineFilters): Promise<T[]>;
    public static async all<T extends SolidModel>(this: SolidModelConstructor<T>, filters?: EngineFilters): Promise<T[]>;
    public static async all<T extends SolidModel>(this: SolidModelConstructor<T>, filters: EngineFilters = {}): Promise<T[]> {
        filters = this.prepareEngineFilters(filters);

        const { documentPermissions, stopTracking } = this.instance().trackPublicPermissions();

        const models = await this.withCollection(() => super.all(filters) as unknown as T[]);

        stopTracking();

        models.forEach(model => (model._publicPermissions = documentPermissions[model.requireDocumentUrl()]));

        return models;
    }
    /* eslint-enable max-len */

    public static prepareEngineFilters(filters: EngineFilters = {}): EngineFilters {
        // This is necessary because a SolidEngine behaves differently than other engines.
        // Even if a document is stored using compacted IRIs, a SolidEngine will need them expanded
        // because it's ultimately stored in turtle, not json-ld.
        const compactIRIs = !(this.requireFinalEngine() instanceof SolidEngine);

        return this.instance().convertEngineFiltersToJsonLD(filters, compactIRIs);
    }

    public static rdfTerm(property: string): string {
        return expandIRI(property, {
            extraContext: this.rdfContexts,
            defaultPrefix: Object.values(this.rdfContexts).shift(),
        });
    }

    public static async newFromJsonLD<T extends SolidModel>(
        this: SolidModelConstructor<T>,
        sourceJsonLD: JsonLD,
        baseUrl?: string,
        sourceResourceId?: string,
    ): Promise<T> {
        const jsonld = mintJsonLDIdentifiers(sourceJsonLD);
        const rdfDocument = await RDFDocument.fromJsonLD(jsonld, baseUrl ?? this.collection);
        const flatJsonLD = await rdfDocument.toJsonLD();
        const resourceId = sourceResourceId ?? this.findResourceId(rdfDocument.statements, baseUrl);
        const resource = rdfDocument.resource(resourceId);
        const documentUrl = baseUrl || urlRoute(resourceId);
        const attributes = await this.instance().parseEngineDocumentAttributes(
            documentUrl,
            flatJsonLD as EngineDocument,
            resourceId,
        );

        if (this.hasAutomaticTimestamp(TimestampField.CreatedAt))
            attributes['createdAt'] = resource?.getPropertyValue(IRI('purl:created'));

        if (this.hasAutomaticTimestamp(TimestampField.UpdatedAt))
            attributes['updatedAt'] = resource?.getPropertyValue(IRI('purl:modified'));

        return tap(this.newInstance(objectWithoutEmpty(attributes)), async (model) => {
            await model.loadDocumentModels(documentUrl, flatJsonLD as EngineDocument);

            model.reset();
            model._sourceSubject = sourceJsonLD['@id'] ? parseResourceSubject(sourceJsonLD['@id']) : {};

            // TODO this should be recursive to take care of 2nd degree relations.
            for (const relationName of this.relations) {
                const relation = model.requireRelation(relationName);
                const models = relation.getLoadedModels();

                if (!relation.enabled) {
                    continue;
                }

                when(relation, isSolidDocumentRelation).reset(models);

                models.forEach(model => model.reset());
            }
        });
    }

    public static async createFromJsonLD<T extends SolidModel>(
        this: SolidModelConstructor<T>,
        jsonld: JsonLD,
        baseUrl?: string,
        resourceId?: string,
    ): Promise<T> {
        return tap(await this.newFromJsonLD(jsonld, baseUrl, resourceId), model => model.save(baseUrl));
    }

    public static async createInDocument<T extends SolidModel>(
        this: SolidModelConstructor<T>,
        attributes: Attributes,
        documentUrl: string,
        resourceHash?: string,
    ): Promise<T> {
        return tap(new this(attributes) as T, instance => instance.saveInDocument(documentUrl, resourceHash));
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

        for (const relation of arrayWithout(this.relations, this.reservedRelations)) {
            const relationA = a.requireRelation(relation);
            const relationB = b.requireRelation(relation);

            if (!relationA.enabled || !relationB.enabled) {
                continue;
            }

            await when(relationA, synchronizesRelatedModels).__synchronizeRelated(relationB);
            await when(relationB, synchronizesRelatedModels).__synchronizeRelated(relationA);
        }
    }

    protected static bootRdfContexts(
        initialClass?: typeof SolidModel,
        initialRdfContexts: Record<string, string> = {},
    ): Record<string, string> {
        const modelClass = initialClass ?? this;
        const parentModelClass = Object.getPrototypeOf(modelClass);
        const rdfContext = Object.getOwnPropertyDescriptor(modelClass, 'rdfContext')?.value as string | null;
        const rdfContexts = {
            ...initialRdfContexts,
            ...Object.getOwnPropertyDescriptor(modelClass, 'rdfContexts')?.value ?? {} as Record<string, string>,
        };

        rdfContexts.default ??= rdfContext ?? Object.values(rdfContexts).find(url => !!url);

        if (!parentModelClass) {
            return {
                ...rdfContexts,
                default: rdfContexts.default ?? 'http://www.w3.org/ns/solid/terms#',
                solid: 'http://www.w3.org/ns/solid/terms#',
                crdt: 'https://vocab.noeldemartin.com/crdt/',
                ldp: 'http://www.w3.org/ns/ldp#',
                purl: 'http://purl.org/dc/terms/',
                rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
                rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
            };
        }

        return this.bootRdfContexts(parentModelClass, rdfContexts);
    }

    protected static bootRdfsClasses(initialClass?: typeof SolidModel): string[] {
        const modelClass = initialClass ?? this;
        const rdfsClass = Object.getOwnPropertyDescriptor(modelClass, 'rdfsClass')?.value as string | null;
        const rdfsClasses = Object.getOwnPropertyDescriptor(modelClass, 'rdfsClasses')?.value as string[] | null;

        if (rdfsClasses && rdfsClasses.length > 0) {
            return arrayUnique(rdfsClasses?.map(name => this.rdfTerm(name)) ?? []);
        }

        if (rdfsClass) {
            return [this.rdfTerm(rdfsClass)];
        }

        const parentModelClass = Object.getPrototypeOf(modelClass);

        if (!parentModelClass) {
            return [this.rdfTerm(this.getDefaultRdfContext() + this.modelName)];
        }

        return this.bootRdfsClasses(parentModelClass);
    }

    protected static bootFields(): SolidBootedFieldsDefinition {
        const modelClass = this;
        const instance = modelClass.pureInstance();
        const fields = modelClass.fields as BootedFieldsDefinition<{
            rdfProperty?: string;
            rdfPropertyAliases?: string[];
        }>;
        const defaultRdfContext = modelClass.getDefaultRdfContext();

        if (instance.static().hasAutomaticTimestamp(TimestampField.CreatedAt)) {
            delete fields[TimestampField.CreatedAt];
        }

        if (instance.static().hasAutomaticTimestamp(TimestampField.UpdatedAt)) {
            delete fields[TimestampField.UpdatedAt];
        }

        for (const [name, field] of Object.entries(fields)) {
            field.rdfProperty = IRI(
                field.rdfProperty ?? `${defaultRdfContext}${name}`,
                modelClass.rdfContexts,
                defaultRdfContext,
            );
            field.rdfPropertyAliases = field.rdfPropertyAliases
                ?.map(property => IRI(property, modelClass.rdfContexts, defaultRdfContext))
                ?? [];
        }

        delete fields[modelClass.primaryKey]?.rdfProperty;
        delete fields[modelClass.primaryKey]?.rdfPropertyAliases;

        return fields as unknown as SolidBootedFieldsDefinition;
    }

    protected static getDefaultRdfContext(): string {
        return this.rdfContexts.default ?? '';
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

    protected static findResourceId(quads: Quad[], baseUrl?: string): string {
        const resourcesTypes = quads.reduce(
            (resourcesTypes, quad) => {
                if (quad.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
                    resourcesTypes[quad.subject.value] = resourcesTypes[quad.subject.value] ?? [];

                    resourcesTypes[quad.subject.value]?.push(quad.object.value);
                }

                return resourcesTypes;
            },
            {} as Record<string, string[]>,
        );
        const resourceId = Object
            .entries(resourcesTypes)
            .find(([_, types]) => !this.rdfsClasses.some(rdfsClass => !types.includes(rdfsClass)))?.[0];

        if (!resourceId) {
            throw new SoukaiError('Couldn\'t find matching resource in JSON-LD');
        }

        return baseUrl ? urlResolve(baseUrl, resourceId) : resourceId;
    }

    // TODO this should be optional
    public url!: string;

    public deletedAt?: Date;
    public authorizations?: SolidACLAuthorization[];
    public metadata!: Metadata;
    public operations!: Operation[];
    public tombstone?: Tombstone;
    public relatedAuthorizations!: SolidACLAuthorizationsRelation<this>;
    public relatedMetadata!: SolidHasOneRelation<this, Metadata, SolidModelConstructor<Metadata>>;
    public relatedOperations!: OperationsRelation<this>;
    public relatedTombstone!: TombstoneRelation<this>;

    protected _documentExists!: boolean;
    protected _sourceDocumentUrl!: string | null;
    protected _trackedDirtyAttributes!: Attributes;
    protected _removedResourceUrls!: string[];
    protected _usesRdfAliases!: boolean;
    declare protected _relations: Record<string, SolidRelation>;

    private _sourceSubject: SubjectParts = {};
    declare private _history?: boolean;
    declare private _tombstone?: boolean;

    protected initialize(attributes: Attributes, exists: boolean): void {
        this._documentExists = exists;
        this._sourceDocumentUrl = this._sourceDocumentUrl ?? null;
        this._trackedDirtyAttributes = {};
        this._removedResourceUrls = [];
        this._usesRdfAliases = false;

        super.initialize(attributes, exists);
    }

    protected initializeRelations(): void {
        super.initializeRelations();

        this.initializeRelationsEnabling();
        this.initializeMetadataRelation();
    }

    protected initializeRelationsEnabling(): void {
        if (!this.static().hasAutomaticTimestamps()) {
            this._proxy.relatedMetadata.disable();
        }

        if (!this._proxy.tracksHistory()) {
            this._proxy.relatedOperations.disable();
            this._proxy.relatedTombstone.disable();
        }

        this._proxy.relatedAuthorizations.disable();
    }

    protected initializeMetadataRelation(): void {
        if (!this._proxy.relatedMetadata.enabled) {
            return;
        }

        const metadataModelClass = requireBootedModel<typeof Metadata>('Metadata');
        const metadataModel = metadataModelClass.newInstance(objectWithoutEmpty({
            resourceUrl: this._attributes[this.static('primaryKey')],
            createdAt: this._attributes.createdAt,
            updatedAt: this._attributes.updatedAt,
        }), false);

        metadataModel.resourceUrl && metadataModel.mintUrl(this.getDocumentUrl() || undefined, this._documentExists);
        this._proxy.relatedMetadata.attach(metadataModel);

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

    public async saveInDocument(documentUrl: string, resourceHash?: string): Promise<this> {
        this.exists()
            ? assert(
                this.getDocumentUrl() === documentUrl,
                SoukaiError,
                'Model already exists and is not stored in the given document',
            )
            : this.mintUrl(documentUrl, true, resourceHash);

        await this.save();

        return this;
    }

    public delete(): Promise<this> {
        return this.static().withCollection(this.guessCollection(), () => super.delete());
    }

    public async softDelete(): Promise<this> {
        if (!this.static().hasAutomaticTimestamps()) {
            throw new SoukaiError('Cannot soft delete a model without automatic timestamps');
        }

        if (this.isSoftDeleted()) {
            return this;
        }

        const now = new Date();

        this.metadata.setAttribute(TimestampField.UpdatedAt, now);
        this.metadata.setAttribute('deletedAt', now);

        await this.save();

        return this;
    }

    public async registerInTypeIndex(typeIndexUrl: string): Promise<void> {
        const documentModelClass = requireBootedModel<typeof SolidDocument>('SolidDocument');
        const document = new documentModelClass({ url: this.getDocumentUrl() });

        await document.register(typeIndexUrl, this.static());
    }

    public mintUrl(documentUrl?: string, documentExists?: boolean, resourceHash?: string): void {
        this.setAttribute(this.static('primaryKey'), this.newUrl(documentUrl, resourceHash));

        if (documentUrl)
            this._documentExists = documentExists ?? true;
    }

    public toJsonLD(options: SolidModelSerializationOptions = {}): Record<string, unknown> {
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

    public async toTurtle(options: SolidModelSerializationOptions = {}): Promise<string> {
        const quads = await jsonldToQuads(this.toJsonLD(options));

        return quadsToTurtle(quads);
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
            .filter(relation => relation.enabled && relation.useSameDocument)
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

        if (ignoreRelations) {
            return this.metadata?.isDirty('deletedAt');
        }

        const dirtyDocumentModels = this.getDocumentModels().filter(model => model.isDirty(undefined, true));
        const removedDocumentModels = this.getRemovedDocumentModels();

        return (dirtyDocumentModels.length + removedDocumentModels.length) > 0;
    }

    public isSoftDeleted(): boolean {
        return !!this.metadata?.deletedAt;
    }

    public enableHistory(): void {
        this._history = true;
    }

    public disableHistory(): void {
        this._history = false;
    }

    public disableTombstone(): void {
        this._tombstone = false;
    }

    public enableTombstone(): void {
        this._tombstone = true;
    }

    public leavesTombstone(): boolean {
        return this._tombstone ?? this.static('tombstone');
    }

    public cleanDirty(ignoreRelations?: boolean): void {
        super.cleanDirty();

        this._documentExists = true;
        this._trackedDirtyAttributes = {};
        this._removedResourceUrls = [];

        Object
            .values(this._relations)
            .filter(isSolidMultiModelDocumentRelation)
            .filter(relation => relation.enabled && relation.useSameDocument)
            .forEach(relation => {
                relation.__modelsInSameDocument = relation.__modelsInSameDocument || [];
                relation.__modelsInSameDocument.push(...relation.__newModels);

                relation.__newModels = [];
            });

        Object
            .values(this._relations)
            .filter(isSolidSingleModelDocumentRelation)
            .filter(relation => relation.enabled && relation.useSameDocument && !!relation.__newModel)
            .forEach(relation => {
                relation.__modelInSameDocument = relation.__newModel;

                delete relation.__newModel;
            });

        if (!ignoreRelations)
            this.getDocumentModels().forEach(model => model.cleanDirty(true));
    }

    public fixMalformedAttributes(): void {
        super.fixMalformedAttributes();

        if (!this.relatedMetadata.enabled) {
            return;
        }

        if (this.static().hasAutomaticTimestamp(TimestampField.CreatedAt)) {
            this.metadata.createdAt = this.getAttribute('createdAt') ?? new Date();
        }

        if (this.static().hasAutomaticTimestamp(TimestampField.UpdatedAt)) {
            this.metadata.updatedAt = this.getAttribute('updatedAt') ?? this.getAttribute('createdAt') ?? new Date();
        }
    }

    public tracksHistory(): boolean {
        return this.static().historyDisabled.has(this)
            ? false
            : this._history ?? this.static('history');
    }

    public withoutTrackingHistory<T>(operation: () => T): T;
    public withoutTrackingHistory<T>(operation: () => Promise<T>): Promise<T>;
    public withoutTrackingHistory<T>(operation: () => T | Promise<T>): T | Promise<T> {
        if (!this.tracksHistory())
            return operation();

        const restoreHistoryTracking = (): true => {
            this.static().historyDisabled.delete(this);

            return true;
        };

        this.static().historyDisabled.set(this);

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
        if (!this.hasRelation('operations') || !this.isRelationLoaded('operations')) {
            throw new SoukaiError('Can\'t rebuild attributes from history if \'operations\'  relation isn\'t loaded');
        }

        if (this.operations.length === 0) {
            return;
        }

        const PropertyOperation = operationClass('PropertyOperation');
        const operations = arraySorted(this.operations, 'date');
        const unfilledAttributes = new Set(Object.keys(this._attributes));
        const arrayFields = Object
            .entries(this.static('fields'))
            .filter(([_, definition]) => definition.type === FieldType.Array)
            .map(([field]) => field);

        unfilledAttributes.delete(this.static('primaryKey'));
        unfilledAttributes.delete(TimestampField.CreatedAt);
        unfilledAttributes.delete(TimestampField.UpdatedAt);

        arrayFields.forEach(field => this.setAttribute(field, []));
        operations.forEach(operation => {
            if (operation instanceof PropertyOperation) {
                const field = this.static().getRdfPropertyField(operation.property);

                field && unfilledAttributes.delete(field);
            }

            operation.apply(this);
        });
        unfilledAttributes.forEach(attribute => this.unsetAttribute(attribute));

        this.setAttribute('createdAt', operations[0]?.date);
        this.setAttribute('updatedAt', operations[operations.length - 1]?.date);
    }

    public getDocumentUrl(): string | null {
        return this.url ? urlRoute(this.url) : null;
    }

    public requireDocumentUrl(): string {
        return this.getDocumentUrl() ?? fail(SoukaiError, 'Failed getting required document url');
    }

    public usesRdfAliases(): boolean {
        return this._usesRdfAliases;
    }

    public getSourceDocumentUrl(): string | null {
        return this._sourceDocumentUrl;
    }

    public setSourceDocumentUrl(sourceDocumentUrl: string | null): void {
        this._sourceDocumentUrl = sourceDocumentUrl;
    }

    public requireContainerUrl(): string {
        return this.getContainerUrl() ?? fail(SoukaiError, 'Failed getting required container url');
    }

    public getContainerUrl(): string | null {
        const documentUrl = this.getDocumentUrl();

        return documentUrl ? urlParentDirectory(documentUrl) : null;
    }

    public getSourceContainerUrl(): string | null {
        const documentUrl = this.getSourceDocumentUrl();

        return documentUrl ? urlParentDirectory(documentUrl) : null;
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
        return this.metadata?.getAttributeValue('createdAt') ?? super.getAttributeValue('createdAt');
    }

    public getUpdatedAtAttribute(): Date {
        return this.metadata?.getAttributeValue('updatedAt') ?? super.getAttributeValue('updatedAt');
    }

    public getDeletedAtAttribute(): Date | undefined {
        return this.metadata?.getAttributeValue('deletedAt') ?? super.getAttributeValue('deletedAt');
    }

    public getDocumentModels(_documentModels?: Set<SolidModel>): SolidModel[] {
        const documentModels = _documentModels ?? new Set();

        if (documentModels.has(this))
            return [...documentModels];

        const documentUrl = this.getDocumentUrl();
        const addModels = (models: SolidModel[]) => models.forEach(model => documentModels.add(model));

        documentModels.add(this);

        for (const relation of Object.values(this._relations)) {
            if (
                !relation.enabled ||
                !relation.loaded ||
                !isSolidDocumentRelation(relation) ||
                !relation.useSameDocument
            ) {
                continue;
            }

            if ((isSolidSingleModelDocumentRelation(relation) && relation.__newModel)) {
                addModels(relation.__newModel.getDocumentModels(documentModels));
            }

            if (isSolidMultiModelDocumentRelation(relation)) {
                addModels(relation.__newModels.map(model => model.getDocumentModels(documentModels)).flat());
            }

            addModels(
                relation
                    .getLoadedModels()
                    .filter(model => model.getDocumentUrl() === documentUrl)
                    .map(model => model.getDocumentModels(documentModels))
                    .flat(),
            );
        }

        return [...documentModels];
    }

    public getRemovedDocumentModels(): SolidModel[] {
        const removedModels = new Set<SolidModel>();

        for (const relation of Object.values(this._relations)) {
            if (
                !relation.enabled ||
                !relation.loaded ||
                !isSolidDocumentRelation(relation) ||
                !isSolidMultiModelDocumentRelation(relation)
            ) {
                continue;
            }

            relation.__removedDocumentModels.forEach(model => removedModels.add(model));
        }

        return [...removedModels];
    }

    public getDirtyDocumentModels(): SolidModel[] {
        return this.getDocumentModels().filter(model => model.isDirty());
    }

    public requireRelation<T extends SolidRelation = SolidRelation>(relation: string): T;
    public requireRelation<T extends Relation = Relation>(relation: string): T;
    public requireRelation<T extends SolidRelation = SolidRelation>(relation: string): T {
        return super.requireRelation(relation);
    }

    public getRelationModel<T extends SolidModel>(relation: string): T | null;
    public getRelationModel<T extends Model>(relation: string): T | null;
    public getRelationModel<T extends SolidModel>(relation: string): T | null {
        return super.getRelationModel<T>(relation);
    }

    public getRelationModels<T extends SolidModel>(relation: string): T[] | null;
    public getRelationModels<T extends Model>(relation: string): T[] | null;
    public getRelationModels<T extends SolidModel>(relation: string): T[] | null {
        return super.getRelationModels<T>(relation);
    }

    public setRelationModel(relation: string, model: SolidModel | null): void {
        return super.setRelationModel(relation, model);
    }

    public setRelationModels(relation: string, models: SolidModel[] | null): void {
        return super.setRelationModels(relation, models);
    }

    public getRelatedModels(_relatedModels?: Set<SolidModel>): SolidModel[] {
        const relatedModels = _relatedModels ?? new Set();

        if (relatedModels.has(this))
            return [...relatedModels];

        relatedModels.add(this);

        for (const relation of Object.values(this._relations)) {
            if (!relation.enabled) {
                continue;
            }

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
        const metadataModelClass = requireBootedModel<typeof Metadata>('Metadata');

        return this
            .hasOne(metadataModelClass, 'resourceUrl')
            .usingSameDocument(true)
            .onDelete('cascade');
    }

    public operationsRelationship(): Relation {
        return (new OperationsRelation(this))
            .usingSameDocument(true)
            .onDelete('cascade');
    }

    public tombstoneRelationship(): Relation {
        return new TombstoneRelation(this);
    }

    public authorizationsRelationship(): Relation {
        return new SolidACLAuthorizationsRelation(this);
    }

    public onMoved(newResourceUrl: string, newDocumentUrl?: string): void {
        newDocumentUrl && this.setSourceDocumentUrl(newDocumentUrl);
        this.setAttribute('url', newResourceUrl);
        this.cleanDirty();

        // TODO update related models as well using same document
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

            attributes[this.static('primaryKey')] = new ModelKey(resourceId || id);

            return this.newInstance(attributes, true);
        };

        const resource = await RDFDocument.resourceFromJsonLDGraph(document as JsonLDGraph, resourceId || id);
        const model = await createModel();

        await model.loadDocumentModels(id, document);

        return tap(model, m => {
            m._sourceDocumentUrl = urlClean(id, { fragment: false });
            m._usesRdfAliases = this.static('rdfsClassesAliases').some(
                types => !types.some(type => !resource.isType(type)),
            );
        });
    }

    protected async createManyFromEngineDocuments(documents: Record<string, EngineDocument>): Promise<this[]> {
        const rdfsClasses = [this.static('rdfsClasses'), ...this.static('rdfsClassesAliases')];
        const models = await Promise.all(Object.entries(documents).map(async ([documentUrl, engineDocument]) => {
            const rdfDocument = await RDFDocument.fromJsonLD(engineDocument);

            return Promise.all(
                rdfDocument
                    .resources
                    .filter(
                        (resource): resource is RDFResource & { url: string } =>
                            !!resource.url &&
                            rdfsClasses.some(types => !types.some(type => !resource.isType(type))),
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
                .filter(
                    (relation: Relation): relation is SolidDocumentRelationInstance =>
                        relation.enabled && isSolidDocumentRelation(relation),
                )
                .map(async relation => {
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
            if (!relation.enabled || !hasBeforeParentCreateHook(relation)) {
                continue;
            }

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

    protected async performDelete(): Promise<void> {
        if (this.tracksHistory() && this.leavesTombstone()) {
            this.relatedTombstone.create();
        }

        await super.performDelete();
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
        const hasRelations = Object.values(this._relations).filter(
            relation => relation.enabled && isSolidHasRelation(relation),
        );

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
                '@graph': { $push: this.serializeToJsonLD() as EngineDocument },
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

        if ('url' in this._dirtyAttributes) {
            throw new SoukaiError(
                'It wasn\'t possible to generate the changes history for a model because ' +
                `its primary key was modified from '${this.url}' to '${this._originalAttributes.url}'.`,
            );
        }

        if (this.operations.length === 0) {
            const originalAttributes = objectWithoutEmpty(
                objectWithout(this._originalAttributes, [this.static('primaryKey')]),
            );

            for (const [field, value] of Object.entries(originalAttributes)) {
                if (value === null || Array.isArray(value) && value.length === 0)
                    continue;

                if (field in this._trackedDirtyAttributes && this._trackedDirtyAttributes[field] === value)
                    continue;

                this.relatedOperations.attachSetOperation({
                    property: this.static().requireFieldRdfProperty(field),
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

            this.relatedOperations.attachSetOperation({
                property: this.static().requireFieldRdfProperty(field),
                date: this.metadata.updatedAt,
                value: this.getOperationValue(field, value),
            });
        }

        if (this.metadata.isDirty('deletedAt') && !!this.metadata.deletedAt) {
            this.relatedOperations.attachDeleteOperation({ date: this.metadata.deletedAt });
        }
    }

    protected addHistoryOperations(operations: Operation[]): void {
        const PropertyOperation = operationClass('PropertyOperation');
        const knownOperationUrls = new Set(this.operations.map(operation => operation.url));
        const newOperations: Operation[] = [];
        const trackedDirtyProperties: Set<string> = new Set();
        const fieldPropertiesMap = Object
            .keys(this.static('fields'))
            .reduce((fieldProperties, field) => {
                const rdfProperty = this.static().getFieldRdfProperty(field);

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

            if ((operation instanceof PropertyOperation) && operation.property in fieldPropertiesMap)
                trackedDirtyProperties.add(operation.property);
        }

        this.setRelationModels('operations', arraySorted([...this.operations, ...newOperations], ['date', 'url']));
        this.removeDuplicatedHistoryOperations();
        this.rebuildAttributesFromHistory();

        for (const trackedDirtyProperty of trackedDirtyProperties) {
            const field = fieldPropertiesMap[trackedDirtyProperty] as string;

            this._trackedDirtyAttributes[field] = this._dirtyAttributes[field];
        }
    }

    protected removeDuplicatedHistoryOperations(): void {
        const PropertyOperation = operationClass('PropertyOperation');
        const inceptionProperties: string[] = [];
        const duplicatedOperationUrls: string[] = [];
        const inceptionOperations = this.operations.filter(
            operation => operation.date.getTime() === this.metadata.createdAt?.getTime(),
        );
        const isNotDuplicated = (operation: Operation): boolean => !duplicatedOperationUrls.includes(operation.url);

        for (const inceptionOperation of inceptionOperations) {
            if (!(inceptionOperation instanceof PropertyOperation)) {
                continue;
            }

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

    protected isContainedBy<T extends typeof SolidContainer>(model: T): SolidIsContainedByRelation {
        return new SolidIsContainedByRelation(this, model);
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
        const removedDocumentModels = this.getRemovedDocumentModels();

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

            for (const removedModel of removedDocumentModels) {
                removedModel.getDocumentModels().forEach(model => graphUpdates.push({
                    $updateItems: {
                        $where: { '@id': model.url },
                        $unset: true,
                    },
                }));
            }
        }

        if (super.isDirty() && this.url) {
            const modelUpdates = super.getDirtyEngineDocumentUpdates();

            // This is necessary because a SolidEngine behaves differently than other engines.
            // Even if a document is stored using compacted IRIs, a SolidEngine will need them expanded
            // because it's ultimately stored in turtle, not json-ld.
            const compactIRIs = !(this.requireFinalEngine() instanceof SolidEngine);

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
            ? { '@graph': graphUpdates[0] as EngineAttributeUpdateOperation }
            : { '@graph': { $apply: graphUpdates } };
    }

    protected async parseEngineDocumentAttributes(
        id: Key,
        document: EngineDocument,
        resourceId?: string,
    ): Promise<Attributes> {
        return this.parseEngineDocumentAttributesFromJsonLD(document, resourceId || id as string);
    }

    protected castAttribute(value: unknown, options: ModelCastAttributeOptions = {}): unknown {
        const prepareValue = () => {
            const isNullOrUndefined = typeof value === 'undefined' || value === null;

            switch (options.definition?.type) {
                case FieldType.Array: {
                    const arrayValue = isNullOrUndefined ? [] : arrayFrom(value);
                    const uniqueArrayValue = arrayUnique(arrayValue);

                    if (arrayValue.length !== uniqueArrayValue.length) {
                        // eslint-disable-next-line no-console
                        console.warn('An array field had duplicate values, this is not supported in Solid models.');
                    }

                    return uniqueArrayValue;
                }
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

        return super.castAttribute(prepareValue(), options);
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

        return `${documentUrl}-${shortId()}${fragment ? `#${fragment}` : ''}`;
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
                if (!relation.enabled) {
                    continue;
                }

                relation
                    .getLoadedModels()
                    .forEach(model => relation.setForeignAttributes(model));
            }
        }
    }

    private getOperationValue(field: string, value: unknown): unknown {
        const definition = this.static().getFieldDefinition(field, value);

        if (isArrayFieldDefinition(definition)) {
            return arrayFilter(
                arrayFrom(value, true).map(itemValue => this.getOperationValue(`${field}.*`, itemValue)),
            );
        }

        if (value && definition.type === FieldType.Key) {
            return new ModelKey(value);
        }

        return value;
    }

    private addArrayHistoryOperations(field: string, dirtyValue: unknown, originalValue: unknown): void {
        const originalValues = arrayFrom(this.getOperationValue(field, originalValue), true);
        const dirtyValues = arrayFrom(this.getOperationValue(field, dirtyValue), true);
        const { added, removed } = arrayDiff(
            originalValues,
            dirtyValues,
            (a, b) => {
                if (a instanceof ModelKey && b instanceof ModelKey) {
                    return a.equals(b);
                }

                return a === b;
            },
        );

        if (added.length > 0) {
            this.relatedOperations.attachAddOperation({
                property: this.static().getFieldRdfProperty(field),
                date: this.metadata.updatedAt,
                value: arrayFilter(added),
            });
        }

        if (removed.length > 0) {
            this.relatedOperations.attachRemoveOperation({
                property: this.static().getFieldRdfProperty(field),
                date: this.metadata.updatedAt,
                value: arrayFilter(removed),
            });
        }
    }

    private reconcileModelTimestamps(wasTouchedBeforeSaving: boolean): void {
        const [firstOperation, ...otherOperations] = this.operations ?? [];

        if (firstOperation) {
            this.setAttribute(
                TimestampField.UpdatedAt,
                otherOperations.reduce(
                    (updatedAt, operation) => updatedAt > operation.date ? updatedAt : operation.date,
                    firstOperation.date,
                ),
            );

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
