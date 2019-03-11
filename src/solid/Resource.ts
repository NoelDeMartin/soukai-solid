import $rdf, { IndexedFormula, NamedNode } from 'rdflib';

export type LiteralValue = string | number | boolean;

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

    public static type(type: string): ResourceProperty {
        return new ResourceProperty('a', { url: type });
    }

    private predicate: IRI | 'a';

    private object: LiteralValue | IRI;

    private constructor(
        predicate: IRI | 'a',
        object: LiteralValue | IRI,
    ) {
        this.predicate = predicate;
        this.object = object;
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
        const name = this.getProperty('http://cmlns.com/foaf/0.1/name');

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

    public getProperty(
        property: string,
        defaultValue: LiteralValue | null = null,
    ): LiteralValue | null {
        const value = this.data.anyValue(
            $rdf.sym(this.url),
            new NamedNode(property),
            null as any,
            null as any
        );

        return value !== null ? value : defaultValue;
    }

    public getProperties(): { [property: string]: IRI | LiteralValue } {
        const properties = {};

        const terms = this.data.each(
            $rdf.sym(this.url),
            null as any,
            null as any,
            null as any
        );

        for (const term of terms) {
            properties[term.value] = this.data.anyValue(
                $rdf.sym(this.url),
                $rdf.sym(term.value),
                null as any,
                null as any
            );
        }

        return properties;
    }

}
