import { Model, Engine, Attributes, Document, Key, FieldsDefinition, FieldDefinition } from 'soukai';

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

}

export class SolidEngine implements Engine {

    constructor();

    create(model: typeof SolidModel, attributes: Attributes): Promise<Key>;

    readOne(model: typeof SolidModel, id: Key): Promise<Document>;

    readMany(model: typeof SolidModel): Promise<Document[]>;

    update(
        model: typeof SolidModel,
        id: Key,
        dirtyAttributes: Attributes,
        removedAttributes: string[],
    ): Promise<void>;

    delete(model: typeof SolidModel, id: Key): Promise<void>;

}
