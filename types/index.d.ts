import {
    Attributes,
    Documents,
    Engine,
    EngineAttributes,
    FieldDefinition,
    FieldsDefinition,
    Filters,
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

    public static ldpResource: boolean;

    public static ldpContainer: boolean;

    public static rdfContexts: { [alias: string]: string };

    public static rdfsClasses: string[] | Set<string>;

    public static mintsUrls: boolean;

    public static instance: SolidModel;

    public static from(containerUrl: string): typeof SolidModel;

    public static fromJSONLD<T extends SolidModel>(json: object): Promise<T>;

    public static at(containerUrl: string): typeof SolidModel;

    public static prepareEngineFilters(filters?: Filters): Filters;

    protected static pureInstance: SolidModel;

    protected classDef: typeof SolidModel;

    public save<T extends Model>(containerUrl?: string): Promise<T>;

    public toJSONLD(): object;

    protected contains(model: typeof SolidModel): MultiModelRelation;

    protected isContainedBy(model: typeof SolidModel): SingleModelRelation;

    protected embeds(model: typeof SolidModel): SolidEmbedsRelation;

    protected isEmbeddedBy(model: typeof SolidModel): SingleModelRelation;

    protected getDefaultRdfContext(): string;

    protected newUrl(): string;

}

interface RequestOptions {
    headers?: object;
    method?: string;
    body?: string;
}

export type Fetch = (url: string, options?: RequestOptions) => Promise<Response>;

interface SolidDocumentsCache {
    add(document: SolidDocument): void;
    get(id: string): SolidDocument | null;
    forget(id: string): void;
    clear(): void;
}

export interface SolidDocument extends EngineAttributes {
    '@id': string;
    '@type': { '@id': string } | { '@id': string }[];
    __embedded: Documents;
}

export interface SolidEngineConfig {
    globbingBatchSize: number | null;
    useCache: boolean;
}

export class SolidEngine implements Engine {

    readonly cache: SolidDocumentsCache;

    readonly config: SolidEngineConfig;

    constructor(fetch: Fetch, config?: Partial<SolidEngineConfig>);

    create(collection: string, attributes: EngineAttributes, id?: string): Promise<string>;

    readOne(collection: string, id: string): Promise<EngineAttributes>;

    readMany(collection: string, filters?: Filters): Promise<Documents>;

    update(
        collection: string,
        id: string,
        dirtyAttributes: Attributes,
        removedAttributes: string[],
    ): Promise<void>;

    delete(collection: string, id: string): Promise<void>;

}
