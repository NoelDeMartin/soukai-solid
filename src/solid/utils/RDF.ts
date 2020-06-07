import { JsonLdParser as JsonLDParser } from 'jsonld-streaming-parser';
import { JsonLdSerializer as JsonLDSerializer } from 'jsonld-streaming-serializer';
import { Parser as TurtleParser } from 'n3';
import { Quad } from 'rdf-js';

import RDFDocument from '@/solid/RDFDocument';

type IRINamespacesMap = { [prefix: string]: string };

const KNOWN_NAMESPACES: IRINamespacesMap = {
    foaf: 'http://xmlns.com/foaf/0.1/',
    ldp: 'http://www.w3.org/ns/ldp#',
    pim: 'http://www.w3.org/ns/pim/space#',
    purl: 'http://purl.org/dc/terms/',
    rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    schema: 'https://schema.org/',
    solid: 'http://www.w3.org/ns/solid/terms#',
    xsd: 'http://www.w3.org/2001/XMLSchema#',
};

export interface TurtleParsingOptions {
    baseUrl?: string,
    format?: string,
}

class RDF {

    public parseTurtle(turtle: string, options: TurtleParsingOptions = {}): Promise<RDFDocument> {
        return new Promise((resolve, reject) => {
            const quads: Quad[] = [];
            const parser = new TurtleParser({
                baseIRI: options.baseUrl || '',
                format: options.format || 'text/turtle',
            });

            parser.parse(turtle, (error, quad) => {
                if (error) {
                    reject(error);
                    return;
                }

                if (!quad) {
                    resolve(new RDFDocument(options.baseUrl || '', quads));
                    return;
                }

                quads.push(quad);
            });
        });
    }

    public async parseJsonLD(json: object): Promise<RDFDocument> {
        return new Promise((resolve, reject) => {
            const quads: Quad[] = [];
            const parser = new JsonLDParser({ baseIRI: json['@id'] || '' });

            parser.on('data', quad => {
                quads.push(quad);
            });
            parser.on('error', reject);
            parser.on('end', () => resolve(new RDFDocument(json['@id'] || null, quads)));

            parser.write(JSON.stringify(json));
            parser.end();
        });
    }

    public async createJsonLD(statements: Quad[]): Promise<object> {
        statements.sort((a: Quad, b: Quad) => a.subject.value.localeCompare(b.subject.value));

        return new Promise((resolve, reject) => {
            const serializer = new JsonLDSerializer();
            let flattened = '';

            serializer.on('data', data => flattened += data);
            serializer.on('error', reject);
            serializer.on('end', () => resolve({ '@graph': JSON.parse(flattened) }));

            for (const statement of statements) {
                serializer.write(statement);
            }
            serializer.end();
        });
    }

    public async flattenJsonLD(json: object): Promise<object> {
        const document = await this.parseJsonLD(json);

        return document.toJsonLD();
    }

    public getJsonLDProperty(json: object, property: string): any {
        property = IRI(property);

        if (property in json)
            return json[property];

        if (!('@context' in json))
            return;

        const context = json['@context'] as MapObject<string>;
        const contextProperty = Object
            .entries(context)
            .find(([name, url]) => property.startsWith(url));

        if (!contextProperty)
            return;

        const propertyPrefix = (contextProperty[0] === '@vocab' ? '' : `${contextProperty[0]}:`);

        return json[propertyPrefix + property.substr(contextProperty[1].length)];
    }

}

export function IRI(value: string, namespaces: IRINamespacesMap = {}): string {
    if (/^https?:\/\//.test(value))
        return value;

    const colonIndex = value.indexOf(':');
    if (colonIndex === -1)
        return value;

    namespaces = {
        ...KNOWN_NAMESPACES,
        ...namespaces,
    };

    const namespace = value.substr(0, colonIndex);
    if (!(namespace in namespaces))
        return value;

    return namespaces[namespace] + value.substr(namespace.length + 1);
}

export default new RDF();
