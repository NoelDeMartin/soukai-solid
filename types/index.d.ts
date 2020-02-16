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

    create(attributes: Attributes): Promise<R>;

}

export interface SolidFieldsDefinition extends FieldsDefinition {
    [field: string]: SolidFieldDefinition;
}

export interface SolidFieldDefinition extends FieldDefinition {
    rdfProperty?: string;
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

    public static at(containerUrl: string): typeof SolidModel;

    public static prepareEngineFilters(filters?: Filters): Filters;

    protected static pureInstance: SolidModel;

    public save<T extends Model>(containerUrl?: string): Promise<T>;

    protected contains(model: typeof SolidModel): MultiModelRelation;

    protected isContainedBy(model: typeof SolidModel): SingleModelRelation;

    protected embeds(model: typeof SolidModel): SolidEmbedsRelation;

    protected isEmbeddedBy(model: typeof SolidModel): SingleModelRelation;

    protected getDefaultRdfContext(): string;

    protected newUrl(parentUrl?: string): string;

}

interface RequestOptions {
    headers?: object;
    method?: string;
    body?: string;
}

export type Fetch = (url: string, options?: RequestOptions) => Promise<Response>;

export class SolidEngine implements Engine {

    constructor(fetch: Fetch);

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
