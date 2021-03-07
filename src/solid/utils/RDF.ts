import type { Quad } from 'rdf-js';

import { fromRDF } from '@/solid/external';
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
        const resources = await fromRDF(statements);

        return {
            '@graph': resources,
        };
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
