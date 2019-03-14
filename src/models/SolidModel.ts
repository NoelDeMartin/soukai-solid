import { Model, FieldsDefinition, FieldDefinition, SoukaiError } from 'soukai';

import Str from '@/utils/Str';
import Url from '@/utils/Url';
import UUID from '@/utils/UUID';

export interface SolidFieldsDefinition extends FieldsDefinition {
    [field: string]: SolidFieldDefinition;
}

export interface SolidFieldDefinition extends FieldDefinition {
    rdfProperty: string;
}

export default class SolidModel extends Model {

    public static fields: SolidFieldsDefinition | any;

    public static ldpContainer: boolean;

    public static rdfContexts: { [alias: string]: string } = {};

    public static rdfsClasses: string[] | Set<string> = [];

    public static from(containerUrl: string): typeof SolidModel {
        this.collection = containerUrl;

        return this;
    }

    public static boot(name: string): void {
        super.boot(name);

        this.rdfContexts = {
            ...this.rdfContexts,
            solid: 'http://www.w3.org/ns/solid/terms#',
            rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
            rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
            ldp: 'http://www.w3.org/ns/ldp#',
        };

        const defaultRdfContext = Object.keys(this.rdfContexts).shift();

        this.rdfsClasses = new Set([...this.rdfsClasses].map(
            expression => this.resolveType(expression)
        ));

        const ldpResource = this.resolveType('ldp:Resource');
        if (!this.rdfsClasses.has(ldpResource)) {
            this.rdfsClasses.add(ldpResource);
        }

        const ldpContainerType = this.resolveType('ldp:BasicContainer');
        if (this.ldpContainer && !this.rdfsClasses.has(ldpContainerType)) {
            this.rdfsClasses.add(ldpContainerType);
        }

        for (const field in this.fields) {
            this.fields[field].rdfProperty = this.resolveType(
                this.fields[field].rdfProperty || `${defaultRdfContext}:${field}`,
            );
        }
    }

    private static resolveType(type: string): string {
        const index = type.indexOf(':');

        if (index !== -1) {
            const prefix = type.substr(0, index);

            for (const alias in this.rdfContexts) {
                if (prefix === alias) {
                    return this.rdfContexts[alias] + type.substr(index + 1);
                }
            }
        }

        return type;
    }

    public save<T extends SolidModel>(): Promise<T> {
        if (!this.hasAttribute('id')) {
            const classDef = this.constructor as typeof SolidModel;

            this.setAttribute(
                'id',
                Url.resolve(
                    classDef.collection,
                    (classDef.ldpContainer && this.hasAttribute('name'))
                        ? Str.slug(this.getAttribute('name'))
                        : UUID.generate(),
                ),
            );
        }

        return super.save();
    }

}
