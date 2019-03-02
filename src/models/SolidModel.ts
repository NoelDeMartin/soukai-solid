import { Model } from 'soukai';

export default class SolidModel extends Model {

    public static rdfContexts: { [alias: string]: string } = {};

    public static rdfsClasses: string[] = [];

    public static from(containerUrl: string) {
        this.collection = containerUrl;

        return this;
    }

    public static boot(name: string): void {
        super.boot(name);

        this.rdfsClasses = this.rdfsClasses.map(
            expression => resolveFullTypeUrl(expression, this.rdfContexts)
        );

        for (const field in this.fields) {
            this.fields[field].rdfProperty = resolveFullTypeUrl(
                this.fields[field].rdfProperty,
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
