import {
    Attributes,
    Engine,
    EngineDocument,
    EngineDocumentsCollection,
    EngineFilters,
    EngineUpdates,
    FieldDefinition,
    FieldsDefinition,
    Model,
    MultiModelRelation,
    SingleModelRelation,
} from 'soukai';

export interface SolidEmbedsRelation<
    P extends SolidModel = SolidModel,
    R extends SolidModel = SolidModel,
    RC extends typeof SolidModel = typeof SolidModel,
> extends MultiModelRelation<P, R, RC> {

    save(model: R): Promise<R>;

    create(attributes: Attributes): Promise<R>;

}

export interface SolidFieldsDefinition extends FieldsDefinition {
    [field: string]: SolidFieldDefinition;
}

export interface SolidFieldDefinition extends FieldDefinition {
    rdfProperty: string;
}

export class SolidModel extends Model {

    public static fields: SolidFieldsDefinition | any;

    public static ldpContainer: boolean;

    public static rdfContexts: { [alias: string]: string };

    public static rdfsClasses: string[] | Set<string>;

    public static mintsUrls: boolean;

    public static instance: SolidModel;

    public static from(containerUrl: string): typeof SolidModel;

    public static createFromJsonLD<T extends SolidModel>(json: object): Promise<T>;

    public static at(containerUrl: string): typeof SolidModel;

    public static prepareEngineFilters(filters?: EngineFilters): EngineFilters;

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

    protected createFromEngineDocument<T extends Model>(id: any, document: EngineDocument): Promise<T>;

    protected hasMany(relatedClass: typeof SolidModel, foreignKeyField?: string, localKeyField?: string): MultiModelRelation;

    protected belongsToMany(relatedClass: typeof SolidModel, foreignKeyField?: string, localKeyField?: string): MultiModelRelation;

    protected contains(model: typeof SolidModel): MultiModelRelation;

    protected isContainedBy(model: typeof SolidModel): SingleModelRelation;

    protected getDefaultRdfContext(): string;

    protected newUrl(documentUrl?: string): string;

    protected guessCollection(): string | undefined;

}

interface RequestOptions {
    headers?: object;
    method?: string;
    body?: string;
}

export type Fetch = (url: string, options?: RequestOptions) => Promise<Response>;

export interface SolidEngineConfig {
    globbingBatchSize: number | null;
    useCache: boolean;
}

export class SolidEngine implements Engine {

    constructor(fetch: Fetch, config?: Partial<SolidEngineConfig>);

    create(collection: string, document: EngineDocument, id?: string): Promise<string>;

    readOne(collection: string, id: string): Promise<EngineDocument>;

    readMany(collection: string, filters?: EngineFilters): Promise<EngineDocumentsCollection>;

    update(collection: string, id: string, updates: EngineUpdates): Promise<void>;

    delete(collection: string, id: string): Promise<void>;

}
