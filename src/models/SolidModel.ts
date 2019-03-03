import { Model, FieldsDefinition, FieldDefinition } from 'soukai';

export interface SolidFieldsDefinition extends FieldsDefinition {
    [field: string]: SolidFieldDefinition;
}

export interface SolidFieldDefinition extends FieldDefinition {
    rdfProperty: string;
}

export default class SolidModel extends Model {

    public static fields: SolidFieldsDefinition | any;

    public static rdfContexts: { [alias: string]: string } = {};

    public static rdfsClasses: string[] = [];

    public static from(containerUrl: string): typeof SolidModel {
        this.collection = containerUrl;

        return this;
    }

    public static boot(name: string): void {
        super.boot(name);

        const defaultRdfContext = Object.keys(this.rdfContexts).shift();

        this.rdfsClasses = this.rdfsClasses.map(
            expression => resolveFullTypeUrl(expression, this.rdfContexts)
        );

        for (const field in this.fields) {
            this.fields[field].rdfProperty = resolveFullTypeUrl(
                this.fields[field].rdfProperty || `${defaultRdfContext}:${field}`,
                this.rdfContexts
            );
        }
    }

}

function resolveFullTypeUrl(type: string, rdfContexts: { [alias: string ]: string}): string {
    const index = type.indexOf(':');

    if (index !== -1) {
        const prefix = type.substr(0, index);

        for (const alias in rdfContexts) {
            if (prefix === alias) {
                return rdfContexts[alias] + type.substr(index + 1);
            }
        }
    }

    return type;
}
