import { JsonLdParser as JsonLDParser } from 'jsonld-streaming-parser';
import { Parser as TurtleParser } from 'n3';
import { Quad } from 'rdf-js';

import { Resource } from '@/solid';

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

class RDF {

    public resolveIRI(value: string, namespaces: IRINamespacesMap = {}): string {
        if (/^https?:\/\//.test(value))
            return value;

        namespaces = {
            ...KNOWN_NAMESPACES,
            ...namespaces,
        };

        for (const [prefix, url] of Object.entries(namespaces)) {
            if (!value.startsWith(prefix + ':'))
                continue;

            return url + value.substr(prefix.length + 1);
        }

        return value;
    }

    public parseTurtle(base: string, turtle: string): Promise<Resource> {
        return new Promise((resolve, reject) => {
            const quads: Quad[] = [];
            const parser = new TurtleParser({
                baseIRI: base,
                format: 'text/turtle',
            });

            parser.parse(turtle, (error, quad) => {
                if (error) {
                    reject(error);
                    return;
                }

                if (!quad) {
                    resolve(new Resource(base, quads));
                    return;
                }

                quads.push(quad);
            });
        });
    }

    public async parseJsonLD(json: object): Promise<Resource> {
        return new Promise((resolve, reject) => {
            const id = json['@id'];
            const quads: Quad[] = [];
            const parser = new JsonLDParser({ baseIRI: id });

            parser.on('data', quad => {
                quads.push(quad);
            });
            parser.on('error', reject);
            parser.on('end', () => resolve(new Resource(id, quads)));

            parser.write(JSON.stringify(json));
            parser.end();
        });
    }

}

const instance = new RDF();
const IRIS_CACHE = {};

export function IRI(name: string): string {
    if (!(name in IRIS_CACHE)) {
        IRIS_CACHE[name] = instance.resolveIRI(name);
    }

    return IRIS_CACHE[name];
}

export default instance;
