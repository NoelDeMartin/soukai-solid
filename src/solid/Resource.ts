import { Quad } from 'rdf-js';

import RDF, { IRI } from '@/utils/RDF';

export type LiteralValue = string | number | boolean | Date;

export interface IRIValue {
    iri: string;
}

function isIRIValue(value: any): value is IRIValue {
    return typeof value === 'object' && 'iri' in value;
}

export class ResourceProperty {

    public static literal(property: string, value: LiteralValue): ResourceProperty {
        return new ResourceProperty({ iri: RDF.resolveIRI(property) }, value);
    }

    public static link(property: string, url: string) {
        return new ResourceProperty({ iri: RDF.resolveIRI(property) }, { iri: url });
    }

    public static type(type: string): ResourceProperty {
        return new ResourceProperty('a', { iri: RDF.resolveIRI(type) });
    }

    public readonly predicate: IRIValue | 'a';

    public readonly object: IRIValue | LiteralValue;

    private constructor(predicate: IRIValue | 'a', object: IRIValue | LiteralValue) {
        this.predicate = predicate;
        this.object = object;
    }

    public getPredicateIRI(): string {
        return this.predicate === 'a' ? IRI('rdf:type') : this.predicate.iri;
    }

    public isType(type: string): boolean {
        return (this.predicate === 'a' || this.predicate.iri === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type')
            && typeof this.object === 'object'
            && 'iri' in this.object
            && this.object.iri === RDF.resolveIRI(type);
    }

    public toTurtle(resourceUrl: string = ''): string {
        const subject = `<${encodeURI(resourceUrl)}>`;
        const predicate = this.predicate === 'a' ? this.predicate : `<${encodeURI(this.predicate.iri)}>`;
        const object = this.serializeObjectValue(this.object);

        return `${subject} ${predicate} ${object}`;
    }

    private serializeObjectValue(value: LiteralValue | IRIValue): string {
        if (isIRIValue(value))
            return `<${encodeURI(value.iri)}>`;

        if (value instanceof Date) {
            const digits = (...numbers: number[]) => numbers.map(number => number.toString().padStart(2, '0'));
            const date = digits(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate()).join('-');
            const time = digits(value.getUTCHours(), value.getUTCMinutes(), value.getUTCSeconds()).join(':');

            return `"${date}T${time}Z"^^<${IRI('xsd:dateTime')}>`;
        }

        return JSON.stringify(value);
    }

}

export default class Resource {

    public readonly url: string;
    public readonly sourceStatements: Quad[];

    private statements: Quad[];

    public constructor(url: string, sourceStatements: Quad[]) {
        this.url = url;
        this.sourceStatements = sourceStatements;

        this.statements = this.sourceStatements.filter(statement => statement.subject.value === url);
    }

    public get name(): string | null {
        let name = this.getPropertyValue(IRI('foaf:name'));

        if (Array.isArray(name)) {
            name = name[0];
        }

        return typeof name === 'string' ? name : null;
    }

    public get types(): string[] {
        return this.statements
            .filter(statement => statement.predicate.value === IRI('rdf:type'))
            .map(statement => statement.object.value);
    }

    public get properties(): string[] {
        return this.statements.map(statement => statement.predicate.value);
    }

    public is(type: string): boolean {
        return this.types.indexOf(RDF.resolveIRI(type)) !== -1;
    }

    public isEmpty(): boolean {
        return this.statements.length === 0;
    }

    public getPropertyType(property: string): 'literal' | 'link' | null {
        property = RDF.resolveIRI(property);

        const statement = this.statements.find(statement => statement.predicate.value === property);

        if (!statement)
            return null;

        return statement.object.termType === 'NamedNode' ? 'link' : 'literal';
    }

    public getPropertyValue(
        property: string,
        defaultValue: LiteralValue | null = null,
    ): LiteralValue | LiteralValue[] | null {
        property = RDF.resolveIRI(property);

        const values = this.statements
            .filter(statement => statement.predicate.value === property)
            .map(statement => statement.object.value);

        if (values.length === 0)
            return defaultValue;

        if (values.length === 1)
            return values[0];

        return values;
    }

    public getProperties(): ResourceProperty[] {
        const properties: ResourceProperty[] = [];

        for (const statement of this.statements) {
            switch (statement.object.termType) {
                case 'Literal':
                    properties.push(
                        ResourceProperty.literal(
                            statement.predicate.value,
                            statement.object.datatype.value === IRI('xsd:dateTime')
                                ? new Date(statement.object.value)
                                : statement.object.value,
                        ),
                    );
                    break;
                case 'NamedNode':
                    properties.push(
                        ResourceProperty.link(
                            statement.predicate.value,
                            statement.object.value,
                        ),
                    );
                    break;
            }
        }

        return properties;
    }

    public toJsonLD(): object {
        const jsonld = { '@id': this.url };

        for (const property of this.properties) {
            const value = this.getPropertyValue(property);

            if (property === IRI('rdf:type')) {
                jsonld['@type'] = Array.isArray(value)
                    ? value.map(link => ({ '@id': link as string }))
                    : { '@id': value as string };
                continue;
            }

            switch (this.getPropertyType(property)) {
                case 'literal':
                    jsonld[property] = value;
                    break;
                case 'link':
                    if (Array.isArray(value)) {
                        jsonld[property] = value.map(link => ({ '@id': link }));
                    } else {
                        jsonld[property] = { '@id': value };
                    }
                    break;
            }
        }

        return jsonld;
    }

}
