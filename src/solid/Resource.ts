import $rdf, { IndexedFormula, NamedNode, Literal } from 'rdflib';

import Arr from '@/utils/Arr';

export type LiteralValue = string | number | boolean | Date;

export class IRI {

    public readonly url: string;

    constructor(url: string) {
        this.url = url;
    }

};

export class ResourceProperty {

    public static literal(property: string, value: LiteralValue): ResourceProperty {
        return new ResourceProperty({ url: property }, value);
    }

    public static link(property: string, url: string) {
        return new ResourceProperty({ url: property }, { url });
    }

    public static type(type: string): ResourceProperty {
        return new ResourceProperty('a', { url: type });
    }

    public readonly predicate: IRI | 'a';

    public readonly object: LiteralValue | IRI;

    private constructor(
        predicate: IRI | 'a',
        object: LiteralValue | IRI,
    ) {
        this.predicate = predicate;
        this.object = object;
    }

    public getPredicateUrl(): string {
        return this.predicate === 'a'
            ? 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
            : this.predicate.url;
    }

    public isType(type: string): boolean {
        return (
            this.predicate === 'a' ||
            this.predicate.url === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
        ) &&
        typeof this.object === 'object' &&
        'url' in this.object &&
        this.object.url === type;
    }

    public toTurtle(resourceUrl: string = ''): string {
        return [
            `<${encodeURI(resourceUrl)}>`,
            this.predicate === 'a'
                ? this.predicate
                : `<${encodeURI(this.predicate.url)}>`,
            typeof this.object !== 'object'
                ? JSON.stringify(this.object)
                : this.object instanceof Date
                    ? $rdf.Literal.fromDate(this.object).toNT()
                    : `<${encodeURI(this.object.url)}>`,
        ].join(' ');
    }

}

export default class Resource {

    public readonly url: string;

    private data: IndexedFormula;

    public constructor(url: string, data: IndexedFormula | string) {
        this.url = url;

        if (typeof data === 'string') {
            this.data = $rdf.graph();

            $rdf.parse(data, this.data, url, 'text/turtle', null as any);
        } else {
            this.data = data;
        }
    }

    public get name(): string | null {
        let name = this.getPropertyValue('http://cmlns.com/foaf/0.1/name');

        if (Array.isArray(name)) {
            name = name[0];
        }

        return typeof name === 'string' ? name : null;
    }

    public get types(): string[] {
        const typeTerms = this.data.each(
            $rdf.sym(this.url),
            new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
            null as any,
            null as any
        );

        return typeTerms.map(term => decodeURI(term.value));
    }

    public get properties(): string[] {
        const typeTerms = this.data.each(
            $rdf.sym(this.url),
            null as any,
            null as any,
            null as any
        );

        return Arr.unique(typeTerms.map(term => decodeURI(term.value)));
    }

    public is(type: string | NamedNode): boolean {
        if (typeof type !== 'string') {
            type = type.uri;
        }

        return this.types.indexOf(type) !== -1;
    }

    public getPropertyType(property: string): 'literal' | 'link' | null {
        const statements = this.data.statementsMatching(
            $rdf.sym(this.url),
            new NamedNode(property),
            null as any,
            null as any,
            false
        );

        return statements.length > 0
            ? (statements[0].object instanceof NamedNode ? 'link' : 'literal')
            : null;
    }

    public getPropertyValue(
        property: string,
        defaultValue: LiteralValue | null = null,
    ): LiteralValue | LiteralValue[] | null {
        const statements = this.data.statementsMatching(
            $rdf.sym(this.url),
            new NamedNode(property),
            null as any,
            null as any,
            false
        );

        if (statements.length === 0) {
            return defaultValue;
        } else if (statements.length === 1) {
            return statements[0].object.value;
        } else {
            return statements.map(statement => statement.object.value);
        }
    }

    public getProperties(): ResourceProperty[] {
        const properties: ResourceProperty[] = [];

        const statements = this.data.statementsMatching(
            $rdf.sym(this.url),
            null as any,
            null as any,
            null as any,
            false,
        );

        for (const statement of statements) {
            switch (statement.object.termType) {
                case 'Literal':
                    const literal = statement.object as Literal;

                    properties.push(
                        ResourceProperty.literal(
                            statement.predicate.value,
                            literal.datatype.value === 'http://www.w3.org/2001/XMLSchema#dateTime'
                                ? new Date(literal.value)
                                : literal.value,
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

}
