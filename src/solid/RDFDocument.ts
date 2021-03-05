import { Parser as TurtleParser } from 'n3';
import { SoukaiError } from 'soukai';
import { toRDF } from 'jsonld';
import type { JsonLdObj } from 'jsonld/jsonld-spec';
import type { Quad } from 'rdf-js';

import RDF from '@/solid/utils/RDF';
import RDFResource from '@/solid/RDFResource';
import type { JsonLD, JsonLDGraph } from '@/solid/utils/RDF';
import type RDFResourceProperty from '@/solid/RDFResourceProperty';

import Arr from '@/utils/Arr';
import Url from '@/utils/Url';

export interface TurtleParsingOptions {
    baseUrl?: string;
    format?: string;
    headers?: Headers;
}

export interface RDFDocumentMetadata {
    containsRelativeIRIs?: boolean;
    describedBy?: string;
}

export class RDFParsingError extends SoukaiError {}

export default class RDFDocument {

    static fromTurtle(turtle: string, options: TurtleParsingOptions = {}): Promise<RDFDocument> {
        return new Promise((resolve, reject) => {
            const quads: Quad[] = [];
            const parser = new TurtleParser({
                baseIRI: options.baseUrl || '',
                format: options.format || 'text/turtle',
            });
            const metadata: RDFDocumentMetadata = {
                containsRelativeIRIs: false,
                describedBy: getDescribedBy(options),
            };
            const resolveRelativeIRI = parser._resolveRelativeIRI;

            parser._resolveRelativeIRI = (...args) => {
                metadata.containsRelativeIRIs = true;
                parser._resolveRelativeIRI = resolveRelativeIRI;

                return parser._resolveRelativeIRI(...args);
            };

            parser.parse(turtle, (error, quad) => {
                if (error) {
                    reject(new RDFParsingError(error.message));
                    return;
                }

                if (!quad) {
                    resolve(new RDFDocument(options.baseUrl || '', quads, metadata));
                    return;
                }

                quads.push(quad);
            });
        });
    }

    static async fromJsonLD(json: JsonLD): Promise<RDFDocument> {
        const quads = await toRDF(json as JsonLdObj) as Quad[];

        return new RDFDocument(json['@id'] || null, quads);
    }

    public readonly url: string | null;
    public readonly statements: Quad[];
    public readonly metadata: RDFDocumentMetadata;
    public readonly resourcesIndex: Record<string, RDFResource>;
    public readonly properties: RDFResourceProperty[];
    public readonly resources: RDFResource[];

    constructor(url: string | null, statements: Quad[] = [], metadata: RDFDocumentMetadata = {}) {
        this.url = url;
        this.statements = statements;
        this.metadata = metadata;

        this.resourcesIndex = this.statements.reduce((resourcesIndex, statement) => {
            const resourceUrl = statement.subject.value;

            if (!(resourceUrl in resourcesIndex))
                resourcesIndex[resourceUrl] = new RDFResource(resourceUrl);

            resourcesIndex[resourceUrl].addStatement(statement);

            return resourcesIndex;
        }, {} as Record<string, RDFResource>);

        this.resources = Object.values(this.resourcesIndex);

        this.properties = this.resources.reduce(
            (properties, resource) => [...properties, ...resource.properties],
            [] as RDFResourceProperty[],
        );
    }

    public isEmpty(): boolean {
        return this.statements.length === 0;
    }

    public hasProperty(resourceUrl: string, name: string): boolean {
        return resourceUrl in this.resourcesIndex && name in this.resourcesIndex[resourceUrl].propertiesIndex;
    }

    public async toJsonLD(): Promise<JsonLDGraph> {
        return RDF.createJsonLD(this.statements);
    }

    public resource(url: string): RDFResource | null {
        return this.resourcesIndex[url] ?? null;
    }

    public requireResource(url: string): RDFResource {
        const resource = this.resource(url);

        if (!resource)
            throw new SoukaiError(`Resource '${url}' not found`);

        return resource;
    }

    public clone(url: string | null = null): RDFDocument {
        const document = new RDFDocument(url || this.url);
        const properties = Arr.without(Object.getOwnPropertyNames(this), ['url']);

        Object.assign(
            document,
            properties.reduce((properties, property) => {
                properties[property] = this[property as keyof this];

                return properties;
            }, {} as any),
        );

        return document;
    }

}

function getDescribedBy(options: TurtleParsingOptions): string | undefined {
    if (!options.headers?.has('Link'))
        return undefined;

    const matches = options.headers.get('Link')?.match(/<([^>]+)>; rel="describedBy"/i);

    if (!matches)
        return undefined;

    return Url.resolve(options.baseUrl || '', matches[1]);
}
