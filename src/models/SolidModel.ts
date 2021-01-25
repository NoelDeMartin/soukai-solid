import Soukai, {
    Attributes,
    DocumentAlreadyExists,
    EngineAttributeUpdateOperation,
    EngineAttributeValue,
    EngineDocument,
    EngineFilters,
    EngineUpdates,
    FieldDefinition,
    FieldsDefinition,
    FieldType,
    Model,
    MultiModelRelation,
    SingleModelRelation,
    SoukaiError,
} from 'soukai';

import RDF, { IRI } from '@/solid/utils/RDF';
import RDFResource from '@/solid/RDFResource';

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

export interface SolidFieldsDefinition extends FieldsDefinition {
    [field: string]: SolidFieldDefinition;
}

export interface SolidFieldDefinition extends FieldDefinition {
    rdfProperty: string;
}

abstract class SolidModel extends Model {

    public static primaryKey: string = 'url';

    public static fields: SolidFieldsDefinition | any;

    public static rdfContexts: { [alias: string]: string } = {};

    public static rdfsClasses: string[] | Set<string> = [];

    public static defaultResourceHash: string = 'it';

    public static mintsUrls: boolean = true;

    public static instance: SolidModel;

    protected static pureInstance: SolidModel;

    public static from(parentUrl: string): typeof SolidModel {
        this.collection = parentUrl;

        return this;
    }

    public static at(parentUrl: string): typeof SolidModel {
        return this.from(parentUrl);
    }

    public static boot(name: string): void {
        super.boot(name);

        this.rdfContexts = {
            ...this.rdfContexts,
            solid: 'http://www.w3.org/ns/solid/terms#',
            rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
            rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
            ldp: 'http://www.w3.org/ns/ldp#',
            purl: 'http://purl.org/dc/terms/',
        };

        const defaultRdfContext = this.instance.getDefaultRdfContext();

        if (
            this.instance.hasAutomaticTimestamp('createdAt') &&
            typeof this.fields['createdAt'].rdfProperty === 'undefined'
        ) {
            this.fields['createdAt'].rdfProperty = IRI('purl:created');
        }

        if (
            this.instance.hasAutomaticTimestamp('updatedAt') &&
            typeof this.fields['updatedAt'].rdfProperty === 'undefined'
        ) {
            this.fields['updatedAt'].rdfProperty = IRI('purl:modified');
        }

        this.rdfsClasses = new Set(
            [...this.rdfsClasses].map(
                name =>
                    name.indexOf(':') === -1 ? (defaultRdfContext + name) : IRI(name, this.rdfContexts),
            ),
        );

        for (const field in this.fields) {
            this.fields[field].rdfProperty = IRI(
                this.fields[field].rdfProperty || `${defaultRdfContext}${field}`,
                this.rdfContexts,
            );
        }

        this.fields[this.primaryKey].rdfProperty = null;
    }

    public static createFromEngineDocument<T extends Model, Key = any>(
        id: Key,
        document: EngineDocument,
        resourceId?: string,
    ): Promise<T> {
        return this.instance.createFromEngineDocument(id, document, resourceId);
    }

    public static async find<T extends Model, Key = string>(id: Key): Promise<T | null> {
        const resourceUrl = this.instance.serializeKey(id);
        const documentUrl = Url.route(resourceUrl);
        const containerUrl = Url.parentDirectory(documentUrl);

        this.ensureBooted();

        try {
            const document = await Soukai
                .requireEngine()
                .readOne(containerUrl, documentUrl);

            return this.instance.createFromEngineDocument<T>(documentUrl, document, resourceUrl);
        } catch (error) {
            return null;
        }
    }

    public static all<T extends Model>(filters: EngineFilters = {}): Promise<T[]> {
        filters = this.prepareEngineFilters(filters);

        return this.withCollection(() => super.all(filters));
    }

    public static prepareEngineFilters(filters: EngineFilters = {}): EngineFilters {
        return this.instance.convertEngineFiltersToJsonLD(filters);
    }

    public static newInstance<M extends SolidModel>(attributes: Attributes, exists: boolean = false): M {
        return new (this as any)(attributes, exists);
    }

    public static async newFromJsonLD<T extends SolidModel>(jsonld: object, baseUrl?: string): Promise<T> {
        const flatJsonLD = await RDF.flattenJsonLD(jsonld) as EngineDocument;
        const documentUrl = baseUrl || Url.route(jsonld['@id']);
        const attributes = await this.instance.parseEngineDocumentAttributes(documentUrl, flatJsonLD, jsonld['@id']);
        const model = new (this as any)(attributes) as T;

        await model.loadDocumentModels(documentUrl, flatJsonLD);

        model.resetEngineData();

        // TODO this should be recursive to take care of 2nd degree relations and more.
        for (const relationName of this.relations) {
            const relation = model._relations[relationName];
            const models = relation.getLoadedModels() as SolidModel[];

            models.forEach(model => model.resetEngineData());

            if (relation instanceof SolidHasManyRelation) {
                models.forEach(model => {
                    delete model[relation.foreignKeyName];
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

    public modelClass: typeof SolidModel;

    protected _documentExists: boolean;
    protected _sourceDocumentUrl: string | null = null;

    public save<T extends Model>(collection?: string): Promise<T> {
        return this.modelClass.withCollection(collection || this.guessCollection(), async () => {
            if (!this.url && this.modelClass.mintsUrls)
                this.mintUrl();

            try {
                await super.save();
            } catch (error) {
                if (!(error instanceof DocumentAlreadyExists))
                    throw error;

                this.url = this.newUniqueUrl(this.url);

                await super.save();
            }

            return this as any as T;
        });
    }

    public delete<T extends Model>(): Promise<T> {
        return this.modelClass.withCollection(this.guessCollection() || '', () => super.delete());
    }

    public mintUrl(documentUrl?: string, documentExists?: boolean, resourceHash?: string): void {
        this.setAttribute(this.modelClass.primaryKey, this.newUrl(documentUrl, resourceHash));

        if (documentUrl)
            this._documentExists = documentExists ?? true;
    }

    public toJsonLD(): object {
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

    protected initialize(attributes: Attributes, exists: boolean) {
        super.initialize(attributes, exists);

        this._documentExists = exists;
    }

    protected async createFromEngineDocument<T extends Model>(id: any, document: EngineDocument, resourceId?: string): Promise<T> {
        const createModel = async () => {
            const attributes = await this.parseEngineDocumentAttributes(id, document, resourceId);

            attributes[this.modelClass.primaryKey] = resourceId || id;

            return new (this.modelClass as any)(attributes, true);
        };

        const model = await createModel();

        await model.loadDocumentModels(id, document);

        return Fluent.tap(model, m => m._sourceDocumentUrl = id);
    }

    protected async createManyFromEngineDocuments<T extends Model>(documents: Record<string, EngineDocument>): Promise<T[]> {
        const rdfsClasses = [...this.modelClass.rdfsClasses];
        const isModelResource = (resource: RDFResource) => !rdfsClasses.some(rdfsClass => !resource.isType(rdfsClass));
        const models = await Promise.all(Object.entries(documents).map(async ([documentUrl, engineDocument]) => {
            const rdfDocument = await RDF.parseJsonLD(engineDocument);

            return Promise.all(
                rdfDocument
                    .resources
                    .filter(isModelResource)
                    .map(async resource => this.createFromEngineDocument<T>(documentUrl, engineDocument, resource.url!)),
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
        const id = this.getSerializedPrimaryKey()!;
        const documentUrl = this.getDocumentUrl();
        const createDocument = () => engine.create(
            this.modelClass.collection,
            this.toEngineDocument(),
            documentUrl || undefined,
        );
        const addToDocument = () => engine.update(
            this.modelClass.collection,
            documentUrl!,
            {
                '@graph': { $push: this.serializeToJsonLD(false) as EngineDocument },
            },
        );
        const updateDocument = () => engine.update(
            this.modelClass.collection,
            documentUrl!,
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

        return id;
    }

    protected cleanDirty(): void {
        super.cleanDirty();
        this.getDirtyDocumentModels().map(model => model.cleanDirty());

        this._documentExists = true;

        const sameDocumentRelations = Object
            .values(this._relations)
            .filter(relation => relation instanceof SolidHasManyRelation && relation.useSameDocument) as SolidHasManyRelation[];

        for (const relation of sameDocumentRelations) {
            relation.__modelsInSameDocument = relation.__modelsInSameDocument || [];
            relation.__modelsInSameDocument.push(...relation.__newModels);
            relation.__newModels = [];
        };
    }

    protected async deleteModelsFromEngine(models: SolidModel[]): Promise<void> {
        await this.deleteModels(models);
    }

    protected hasMany(relatedClass: typeof SolidModel, foreignKeyField?: string, localKeyField?: string): SolidHasManyRelation {
        return new SolidHasManyRelation(this, relatedClass, foreignKeyField, localKeyField);
    }

    protected belongsToMany(relatedClass: typeof SolidModel, foreignKeyField?: string, localKeyField?: string): MultiModelRelation {
        return new SolidBelongsToManyRelation(this, relatedClass, foreignKeyField, localKeyField);
    }

    protected isContainedBy(model: typeof SolidModel): SingleModelRelation {
        return new SolidIsContainedByRelation(this, model);
    }

    protected getDefaultRdfContext(): string {
        return Object.values(this.modelClass.rdfContexts).shift() || '';
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

        if (super.isDirty()) {
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
        id: any,
        document: EngineDocument,
        resourceId: string | null = null,
    ): Promise<Attributes> {
        resourceId = resourceId || id;

        const jsonld = (document['@graph'] as EngineDocument[]).find(entity => entity['@id'] === resourceId);

        return this.convertJsonLDToAttributes(jsonld!);
    }

    protected castAttribute(value: any, definition?: FieldDefinition): any {
        if (definition && definition.type === FieldType.Array && !Array.isArray(value)) {
            return [value];
        }

        return super.castAttribute(value, definition);
    }

    protected newUrl(documentUrl?: string, resourceHash?: string): string {
        documentUrl = documentUrl ?? Url.resolve(this.modelClass.collection, UUID.generate());
        resourceHash = resourceHash ?? this.modelClass.defaultResourceHash;

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
                .filter(
                    relation =>
                        relation.loaded &&
                        relation instanceof SolidHasManyRelation &&
                        relation.useSameDocument
                )
                .map((relation: SolidHasManyRelation) => {
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

        const documentUrl = this.getDocumentUrl()!;

        dirtyModels.forEach(model => !model.url && model.mintUrl(documentUrl, this._documentExists, UUID.generate()));

        return dirtyModels;
    }

}

interface SolidModel extends DeletesModels {}
interface SolidModel extends SerializesToJsonLD {}

useMixins(SolidModel, [DeletesModels, SerializesToJsonLD]);

export default SolidModel;
