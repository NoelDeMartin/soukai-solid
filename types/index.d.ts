import {
    Attributes,
    Documents,
    Engine,
    EngineAttributes,
    FieldDefinition,
    FieldsDefinition,
    Filters,
    Model,
    MultipleModelsRelation,
    SingleModelRelation,
} from 'soukai';

export interface SolidFieldsDefinition extends FieldsDefinition {
    [field: string]: SolidFieldDefinition;
}

export interface SolidFieldDefinition extends FieldDefinition {
    rdfProperty?: string;
}

export class SolidModel extends Model {

    public static fields: SolidFieldsDefinition | any;

    public static ldpContainer: boolean;

    public static rdfContexts: { [alias: string]: string };

    public static rdfsClasses: string[] | Set<string>;

    public static from(containerUrl: string): typeof SolidModel;

    public static create<T extends Model>(attributes?: Attributes, containerUrl?: string): Promise<T>;

    public save<T extends Model>(containerUrl?: string): Promise<T>;

    protected contains(model: typeof SolidModel): MultipleModelsRelation;

    protected isContainedBy(model: typeof SolidModel): SingleModelRelation;

}

export class SolidEngine implements Engine {

    constructor();

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
