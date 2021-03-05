import { JsonLdSerializer as JsonLDSerializer } from 'jsonld-streaming-serializer';
import type { Quad } from 'rdf-js';

import IRI from '@/solid/utils/IRI';

export type JsonLD = Partial<{
    '@context': Record<string, unknown>;
    '@id': string;
    '@type': null | string | string[];
}> & { [k: string]: unknown };

export type JsonLDResource = Omit<JsonLD, '@id'> & { '@id': string };
export type JsonLDGraph = { '@graph': JsonLDResource[] };

class RDF {

    public async createJsonLD(statements: Quad[]): Promise<JsonLDGraph> {
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

    public getJsonLDProperty<T = unknown>(json: JsonLD, property: string): T | null {
        property = IRI(property);

        if (property in json)
            return this.getJsonLDPropertyValue(json[property]);

        if (!('@context' in json))
            return null;

        const context = json['@context'] as Record<string, string>;
        const contextProperty = Object
            .entries(context)
            .find(([_, url]) => property.startsWith(url));

        if (!contextProperty)
            return null;

        const propertyPrefix = (contextProperty[0] === '@vocab' ? '' : `${contextProperty[0]}:`);
        const propertyValue = json[propertyPrefix + property.substr(contextProperty[1].length)];

        return this.getJsonLDPropertyValue(propertyValue);
    }

    private getJsonLDPropertyValue<T = unknown>(value: unknown): T | null {
        if (value === undefined)
            return null;

        return (Array.isArray(value) && value.length === 1) ? value[0] : value;
    }

}

export default new RDF();
