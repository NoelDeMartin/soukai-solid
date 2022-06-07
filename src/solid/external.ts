import type { JsonLD, JsonLDGraph, JsonLDResource } from '@noeldemartin/solid-utils';
import type { JsonLdDocument } from 'jsonld';
import type { JsonLdObj } from 'jsonld/jsonld-spec';
import type { ParserOptions } from 'n3';
import type { Quad } from 'rdf-js';

// Some libraries need to be imported dynamically because they rely on `global` being defined, which is not available
// in all environments (for example, it's not available in browsers). The `defineGlobal` method fixes that issue,
// but it needs to be executed before importing those libraries. Hence this setup.

let defineGlobal = () => {
    if (typeof window !== 'undefined')
        window.global = typeof global !== 'undefined'
            ? global
            : typeof globalThis !== 'undefined'
                ? globalThis
                : window as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    defineGlobal = () => {
        // nothing to do here
    };
};

export type DocumentData = {
    quads: Quad[];
    containsRelativeIRIs: boolean;
};

export async function compactJsonLDGraph(jsonld: JsonLDGraph): Promise<JsonLDGraph> {
    defineGlobal();

    const { compact } = await import('./external.chunk');
    const compactedJsonLD = await compact(jsonld as JsonLdDocument, {});

    if ('@graph' in compactedJsonLD) {
        return compactedJsonLD as JsonLDGraph;
    }

    if ('@id' in compactedJsonLD) {
        return { '@graph': [compactedJsonLD] } as JsonLDGraph;
    }

    return { '@graph': [] };
}

export async function fromRDF(dataset: Quad[]): Promise<JsonLDResource[]> {
    defineGlobal();

    const { fromRDF } = await import('./external.chunk');

    return fromRDF(dataset) as Promise<JsonLDResource[]>;
}

export async function toRDF(input: JsonLD, baseUrl?: string): Promise<Quad[]> {
    defineGlobal();

    const { toRDF } = await import('./external.chunk');

    return toRDF(input as JsonLdObj, { base: baseUrl }) as Promise<Quad[]>;
}

export async function fromTurtle(turtle: string, options: ParserOptions = {}): Promise<DocumentData> {
    defineGlobal();

    const { Parser: TurtleParser } = await import('n3');
    const data: DocumentData = {
        quads: [],
        containsRelativeIRIs: false,
    };

    return new Promise((resolve, reject) => {
        const parser = new TurtleParser(options);
        const resolveRelativeIRI = parser._resolveRelativeIRI;

        parser._resolveRelativeIRI = (...args) => {
            data.containsRelativeIRIs = true;
            parser._resolveRelativeIRI = resolveRelativeIRI;

            return parser._resolveRelativeIRI(...args);
        };

        parser.parse(turtle, (error, quad) => {
            if (error) {
                reject(error);
                return;
            }

            if (!quad) {
                resolve(data);
                return;
            }

            data.quads.push(quad);
        });
    });
}
