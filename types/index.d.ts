import {
    Attributes,
    Engine,
    EngineDocument,
    EngineDocumentsCollection,
    EngineFilters,
    EngineUpdates,
    FieldDefinition,
    FieldsDefinition,
    HasManyRelation,
    Model,
    MultiModelRelation,
    SingleModelRelation,
} from 'soukai';

export class SolidHasManyRelation<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends typeof SolidModel = typeof SolidModel,
> extends HasManyRelation<Parent, Related, RelatedClass> {

    public create(attributes?: Attributes, useSameDocument?: boolean): Promise<Related>;

    public loadDocumentModels(document: EngineDocument): Promise<void>;

}

export interface SolidFieldsDefinition extends FieldsDefinition {
    [field: string]: SolidFieldDefinition;
}

export interface SolidFieldDefinition extends FieldDefinition {
    rdfProperty: string;
}

export class SolidModel extends Model {

    public static fields: SolidFieldsDefinition | any;

    public static rdfContexts: { [alias: string]: string };

    public static rdfsClasses: string[] | Set<string>;

    public static mintsUrls: boolean;

    public static instance: SolidModel;

    public static from(containerUrl: string): typeof SolidModel;

    public static at(containerUrl: string): typeof SolidModel;

    public static prepareEngineFilters(filters?: EngineFilters): EngineFilters;

    public static newFromJsonLD<T extends SolidModel>(json: object): Promise<T>;

    protected static withCollection<Result>(collection?: string | (() => Result), operation?: () => Result): Result;

    protected static pureInstance: SolidModel;

    protected classDef: typeof SolidModel;

    public save<T extends Model>(containerUrl?: string): Promise<T>;

    public mintUrl(documentUrl?: string): void;

    public toJsonLD(): object;

    public getIdAttribute(): string;

    protected isDocumentRoot(): boolean;

    protected getDocumentUrl(): string | null;

    protected getDocumentModels(): SolidModel[];

    protected hasMany(relatedClass: typeof SolidModel, foreignKeyField?: string, localKeyField?: string): MultiModelRelation;

    protected belongsToMany(relatedClass: typeof SolidModel, foreignKeyField?: string, localKeyField?: string): MultiModelRelation;

    protected isContainedBy(model: typeof SolidModel): SingleModelRelation;

    protected getDefaultRdfContext(): string;

    protected newUrl(documentUrl?: string): string;

    protected guessCollection(): string | undefined;

}

export class SolidDocument extends SolidModel {}

export class SolidContainerModel extends SolidModel {

    resourceUrls: string[];
    documents: SolidDocument[];
    relatedDocuments: MultiModelRelation<SolidContainerModel, SolidDocument, typeof SolidDocument>;

    public documentsRelationship(): MultiModelRelation;

    protected contains(model: typeof SolidModel): MultiModelRelation;

}

interface RequestOptions {
    headers?: object;
    method?: string;
    body?: string;
}

export type Fetch = (url: string, options?: RequestOptions) => Promise<Response>;

export interface SolidEngineConfig {
    globbingBatchSize: number | null;
}

export class SolidEngine implements Engine {

    constructor(fetch: Fetch, config?: Partial<SolidEngineConfig>);

    create(collection: string, document: EngineDocument, id?: string): Promise<string>;

    readOne(collection: string, id: string): Promise<EngineDocument>;

    readMany(collection: string, filters?: EngineFilters): Promise<EngineDocumentsCollection>;

    update(collection: string, id: string, updates: EngineUpdates): Promise<void>;

    delete(collection: string, id: string): Promise<void>;

}
