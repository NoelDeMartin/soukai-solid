import { Attributes, Model, FieldsDefinition, FieldDefinition, Key } from 'soukai';

import Str from '@/utils/Str';
import Url from '@/utils/Url';
import UUID from '@/utils/UUID';

export interface SolidFieldsDefinition extends FieldsDefinition {
    [field: string]: SolidFieldDefinition;
}

export interface SolidFieldDefinition extends FieldDefinition {
    rdfProperty?: string;
}

export default class SolidModel extends Model {

    public static primaryKey: string = 'url';

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

        if (
            this.hasAutomaticTimestamp('createdAt') &&
            typeof this.fields['createdAt'].rdfProperty === 'undefined'
        ) {
            this.fields['createdAt'].rdfProperty = 'http://purl.org/dc/terms/created';
        }

        if (
            this.hasAutomaticTimestamp('updatedAt') &&
            typeof this.fields['updatedAt'].rdfProperty === 'undefined'
        ) {
            this.fields['updatedAt'].rdfProperty = 'http://purl.org/dc/terms/modified';
        }

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

        this.fields[this.primaryKey].rdfProperty = null;
    }

    public static create<T extends Model>(
        attributes?: Attributes,
        containerUrl?: string,
    ): Promise<T> {
        if (containerUrl) {
            this.from(containerUrl);
        }

        return super.create(attributes);
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

    public save<T extends Model>(containerUrl?: string): Promise<T> {
        const classDef = this.constructor as typeof SolidModel;

        if (!this.hasAttribute(classDef.primaryKey)) {
            this.setAttribute(
                classDef.primaryKey,
                Url.resolve(
                    containerUrl || classDef.collection,
                    (classDef.ldpContainer && this.hasAttribute('name'))
                        ? Str.slug(this.getAttribute('name'))
                        : UUID.generate(),
                ),
            );
        }

        return super.save();
    }

    public getIdAttribute(): Key {
        return this.getAttribute('url');
    }

}
