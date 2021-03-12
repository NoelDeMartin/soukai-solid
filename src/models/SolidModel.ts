import Soukai, {
    DocumentAlreadyExists,
    FieldType,
    Model,
    SoukaiError,
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
    Key,
    ModelConstructor,
    ModelInterface,
    MultiModelRelation,
    SingleModelRelation,
    TimestampFieldValue,
} from 'soukai';

import flattenJsonLD from '@/solid/utils/flattenJsonLD';
import IRI from '@/solid/utils/IRI';
import type { JsonLD } from '@/solid/utils/RDF';
import type RDFResource from '@/solid/RDFResource';

import { useMixins } from '@/utils/mixins';
import Arr from '@/utils/Arr';
import Fluent from '@/utils/Fluent';
import Url from '@/utils/Url';
import UUID from '@/utils/UUID';

import DeletesModels from './mixins/DeletesModels';
import SerializesToJsonLD from './mixins/SerializesToJsonLD';
import SolidBelongsToManyRelation from './relations/SolidBelongsToManyRelation';
import SolidHasManyRelation from './relations/SolidHasManyRelation';
import SolidIsContainedByRelation from './relations/SolidIsContainedByRelation';
import type { SolidModelConstructor } from './inference';
import type { SolidBootedFieldsDefinition, SolidFieldsDefinition } from './fields';
import type SolidContainerModel from './SolidContainerModel';
import RDFDocument from '@/solid/RDFDocument';

export class SolidModel extends Model {

    public static primaryKey: string = 'url';

    public static fields: SolidFieldsDefinition;

    public static rdfContexts: { [alias: string]: string } = {};

    public static rdfsClasses: string[] = [];

    public static defaultResourceHash: string = 'it';

    public static mintsUrls: boolean = true;

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

    public static boot(name: string): void {
        super.boot(name);

        const fields = this.fields as BootedFieldsDefinition<{ rdfProperty?: string }>;

        this.rdfContexts = {
            ...this.rdfContexts,
            solid: 'http://www.w3.org/ns/solid/terms#',
            rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
            rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
            ldp: 'http://www.w3.org/ns/ldp#',
            purl: 'http://purl.org/dc/terms/',
        };

        const instance = this.pureInstance();
        const defaultRdfContext = instance.getDefaultRdfContext();

        if (
            instance.hasAutomaticTimestamp('createdAt') &&
            typeof fields['createdAt'].rdfProperty === 'undefined'
        ) {
            fields['createdAt'].rdfProperty = IRI('purl:created');
        }

        if (
            instance.hasAutomaticTimestamp('updatedAt') &&
            typeof fields['updatedAt'].rdfProperty === 'undefined'
        ) {
            fields['updatedAt'].rdfProperty = IRI('purl:modified');
        }

        this.rdfsClasses = Arr.unique(
            this.rdfsClasses.map(
                name => name.indexOf(':') === -1 ? (defaultRdfContext + name) : IRI(name, this.rdfContexts),
            ),
        );

        for (const field in fields) {
            fields[field].rdfProperty = IRI(
                fields[field].rdfProperty || `${defaultRdfContext}${field}`,
                this.rdfContexts,
            );
        }

        delete fields[this.primaryKey].rdfProperty;

        this.fields = fields;
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
        const documentUrl = Url.route(resourceUrl);
        const containerUrl = Url.parentDirectory(documentUrl);

        this.ensureBooted();

        try {
            const document = await Soukai
                .requireEngine()
                .readOne(containerUrl, documentUrl);

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
        return this.instance().convertEngineFiltersToJsonLD(filters);
    }

    public static async newFromJsonLD<T extends SolidModel>(
        this: SolidModelConstructor<T>,
        jsonld: Omit<JsonLD, '@id'> & { '@id': string },
        baseUrl?: string,
    ): Promise<T> {
        const flatJsonLD = await flattenJsonLD(jsonld) as EngineDocument;
        const documentUrl = baseUrl || Url.route(jsonld['@id']);
        const attributes = await this.instance().parseEngineDocumentAttributes(documentUrl, flatJsonLD, jsonld['@id']);
        const model = this.newInstance(attributes);

        await model.loadDocumentModels(documentUrl, flatJsonLD);

        model.resetEngineData();

        // TODO this should be recursive to take care of 2nd degree relations and more.
        for (const relationName of this.relations) {
            const relation = model._relations[relationName];
            const models = relation.getLoadedModels() as SolidModel[];

            models.forEach(model => model.resetEngineData());

            if (relation instanceof SolidHasManyRelation) {
                models.forEach(model => {
                    delete model[relation.foreignKeyName as keyof SolidModel];
                    relation.__newModels.push(model);
                });
            }
        }

        return model;
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
    url!: string;

    protected _documentExists!: boolean;
    protected _sourceDocumentUrl!: string | null;

    protected initialize(attributes: Attributes, exists: boolean): void {
        super.initialize(attributes, exists);

        this._documentExists = exists;
        this._sourceDocumentUrl = this._sourceDocumentUrl ?? null;
    }

    public static(): SolidModelConstructor<this>;
    public static(property: 'fields'): SolidBootedFieldsDefinition;
    public static(property: 'timestamps'): TimestampFieldValue[];
    public static<T extends keyof SolidModelConstructor<this>>(property: T): SolidModelConstructor<this>[T];
    public static<T extends keyof SolidModelConstructor<this>>(property?: T): SolidModelConstructor<this>[T] {
        return super.static(property as keyof ModelConstructor<this>);
    }

    public save(collection?: string): Promise<this> {
        return this.static().withCollection(collection || this.guessCollection(), async () => {
            if (!this.url && this.static('mintsUrls'))
                this.mintUrl();

            try {
                await super.save();
            } catch (error) {
                if (!(error instanceof DocumentAlreadyExists))
                    throw error;

                this.url = this.newUniqueUrl(this.url);

                await super.save();
            }

            return this;
        });
    }

    public delete(): Promise<this> {
        return this.static().withCollection(this.guessCollection() || '', () => super.delete());
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
    }

    public isDirty(field?: string): boolean {
        if (field)
            return super.isDirty(field);

        if (super.isDirty())
            return true;

        return this.getDirtyDocumentModels().length > 0;
    }

    public getDocumentUrl(): string | null {
        if (!this.url)
            return null;

        return Url.route(this.url);
    }

    public getSourceDocumentUrl(): string | null {
        return this._sourceDocumentUrl;
    }

    public getContainerUrl(): string | null {
        const documentUrl = this.getDocumentUrl();

        return documentUrl ? Url.parentDirectory(documentUrl) : null;
    }

    public getSourceContainerUrl(): string | null {
        const documentUrl = this.getSourceDocumentUrl();

        return documentUrl ? Url.parentDirectory(documentUrl) : null;
    }

    protected async createFromEngineDocument(id: Key, document: EngineDocument, resourceId?: string): Promise<this> {
        const createModel = async () => {
            const attributes = await this.parseEngineDocumentAttributes(id, document, resourceId);

            attributes[this.static('primaryKey')] = resourceId || id;

            return this.newInstance(attributes, true);
        };

        const model = await createModel();

        await model.loadDocumentModels(id, document);

        return Fluent.tap(model, m => m._sourceDocumentUrl = id);
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
                    .map(async resource => this.createFromEngineDocument(documentUrl, engineDocument, resource.url)),
            );
        }));

        return Arr.flatten(models);
    }

    protected async loadDocumentModels(documentUrl: string, document: EngineDocument): Promise<void> {
        const relations = Object
            .values(this._relations)
            .filter(
                relation =>
                    relation instanceof SolidHasManyRelation ||
                    relation instanceof SolidBelongsToManyRelation,
            ) as (SolidHasManyRelation | SolidBelongsToManyRelation)[];

        await Promise.all(relations.map(relation => relation.__loadDocumentModels(documentUrl, document)));
    }

    protected async syncDirty(): Promise<string> {
        const engine = Soukai.requireEngine();
        const documentUrl = this.getDocumentUrl();

        const createDocument = () => engine.create(
            this.static('collection'),
            this.toEngineDocument(),
            documentUrl || undefined,
        );
        const addToDocument = () => engine.update(
            this.static('collection'),
            documentUrl as string,
            {
                '@graph': { $push: this.serializeToJsonLD(false) as EngineDocument },
            },
        );
        const updateDocument = () => engine.update(
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

    protected cleanDirty(): void {
        super.cleanDirty();
        this.getDirtyDocumentModels().map(model => model.cleanDirty());

        this._documentExists = true;

        const sameDocumentRelations = Object
            .values(this._relations)
            .filter<SolidHasManyRelation>(
                (relation): relation is SolidHasManyRelation =>
                    relation instanceof SolidHasManyRelation &&
                    relation.useSameDocument,
            );

        for (const relation of sameDocumentRelations) {
            relation.__modelsInSameDocument = relation.__modelsInSameDocument || [];
            relation.__modelsInSameDocument.push(...relation.__newModels);
            relation.__newModels = [];
        }
    }

    protected async deleteModelsFromEngine(models: this[]): Promise<void> {
        await this.deleteModels(models);
    }

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
                ...this.prepareDirtyDocumentModels().map(model => model.serializeToJsonLD(false)),
            ],
        } as EngineDocument;
    }

    protected getDirtyEngineDocumentUpdates(): EngineUpdates {
        const graphUpdates: EngineAttributeUpdateOperation[] = [];

        graphUpdates.push(
            ...this.prepareDirtyDocumentModels().map(model => ({
                $push: model.serializeToJsonLD(false) as EngineAttributeValue,
            })),
        );

        if (super.isDirty() && this.url) {
            const modelUpdates = super.getDirtyEngineDocumentUpdates();

            graphUpdates.push({
                $updateItems: {
                    $where: { '@id': this.url },
                    $update: this.convertEngineUpdatesToJsonLD(modelUpdates),
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
        resourceId: string | null = null,
    ): Promise<Attributes> {
        resourceId = resourceId || id;

        const jsonld = (document['@graph'] as EngineDocument[]).find(entity => entity['@id'] === resourceId);

        if (!jsonld)
            throw new SoukaiError(`Resource '${resourceId}' not found on document`);

        return this.convertJsonLDToAttributes(jsonld);
    }

    protected castAttribute(value: unknown, definition?: BootedFieldDefinition): unknown {
        if (definition && definition.type === FieldType.Array && !Array.isArray(value)) {
            return [value];
        }

        return super.castAttribute(value, definition);
    }

    protected newUrl(documentUrl?: string, resourceHash?: string): string {
        documentUrl = documentUrl ?? Url.resolve(this.static('collection'), UUID.generate());
        resourceHash = resourceHash ?? this.static('defaultResourceHash');

        return `${documentUrl}#${resourceHash}`;
    }

    protected newUniqueUrl(url?: string): string {
        url = url ?? this.newUrl();

        const uuid = UUID.generate();

        return `${url}-${uuid}`;
    }

    protected guessCollection(): string | undefined {
        if (!this.url)
            return;

        return Url.parentDirectory(this.url);
    }

    private getDirtyDocumentModels(): SolidModel[] {
        // TODO this should be recursive to take care of 2nd degree relations and more.
        const documentUrl = this.getDocumentUrl();
        const dirtyModels = Arr.flatten(
            Object
                .values(this._relations)
                .filter<SolidHasManyRelation>(
                    (relation): relation is SolidHasManyRelation =>
                        relation.loaded &&
                        relation instanceof SolidHasManyRelation &&
                        relation.useSameDocument,
                )
                .map(relation => {
                    const models = [...relation.__newModels];

                    for (const relatedModel of relation.getLoadedModels()) {
                        if (
                            !relatedModel.isDirty() ||
                            relatedModel.getDocumentUrl() !== documentUrl ||
                            models.some(model => model === relatedModel)
                        )
                            continue;

                        models.push(relatedModel);
                    }

                    models.forEach(model => model.setAttribute(relation.foreignKeyName, this.url));

                    return models;
                }),
        );

        return dirtyModels;
    }

    private prepareDirtyDocumentModels(): SolidModel[] {
        const dirtyModels = this.getDirtyDocumentModels();

        if (dirtyModels.length === 0)
            return [];

        if (!this.url)
            this.mintUrl();

        const documentUrl = this.getDocumentUrl() as string;

        dirtyModels.forEach(model => !model.url && model.mintUrl(documentUrl, this._documentExists, UUID.generate()));

        return dirtyModels;
    }

}

useMixins(SolidModel, [DeletesModels, SerializesToJsonLD]);
export interface SolidModel extends ModelInterface<typeof SolidModel> {}
export interface SolidModel extends DeletesModels {}
export interface SolidModel extends SerializesToJsonLD {}
