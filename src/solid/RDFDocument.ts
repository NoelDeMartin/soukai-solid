import { SoukaiError } from 'soukai';
import { fail, objectMap, tap, urlResolve, urlRoute } from '@noeldemartin/utils';
import type { JsonLD, JsonLDGraph, JsonLDResource } from '@noeldemartin/solid-utils';
import type { Quad } from 'rdf-js';

import { fromTurtle, toRDF } from '@/solid/external';
import RDF from '@/solid/utils/RDF';
import RDFResource from '@/solid/RDFResource';
import type RDFResourceProperty from '@/solid/RDFResourceProperty';

export interface TurtleParsingOptions {
    baseUrl?: string;
    format?: string;
    headers?: Headers;
}

export interface CloneOptions {
    changeUrl: string;
    removeResourceUrls: string[];
}

export interface RDFDocumentMetadata {
    containsRelativeIRIs?: boolean;
    describedBy?: string;
    headers?: Headers;
}

export class RDFParsingError extends SoukaiError {}

export default class RDFDocument {

    private static documentsCache: WeakMap<JsonLD, RDFDocument> = new WeakMap();

    public static async fromTurtle(turtle: string, options: TurtleParsingOptions = {}): Promise<RDFDocument> {
        try {
            const data = await fromTurtle(turtle, {
                baseIRI: options.baseUrl || '',
                format: options.format || 'text/turtle',
            });

            return new RDFDocument(options.baseUrl || '', data.quads, {
                containsRelativeIRIs: data.containsRelativeIRIs,
                describedBy: getDescribedBy(options),
                headers: options.headers,
            });
        } catch (error) {
            throw new RDFParsingError((error as Error).message);
        }
    }

    public static async resourceFromJsonLDGraph(
        documentJson: JsonLDGraph,
        resourceId: string,
        resourceJson?: JsonLDResource,
    ): Promise<RDFResource> {
        const requireResourceJson = () => {
            return resourceJson
                ?? documentJson['@graph'].find(entity => entity['@id'] === resourceId)
                ?? fail<JsonLDResource>(SoukaiError, `Resource '${resourceId}' not found on document`);
        };

        const document = this.documentsCache.get(documentJson) ?? await this.fromJsonLD(requireResourceJson());

        return document.requireResource(resourceId);
    }

    public static async fromJsonLD(json: JsonLD, baseUrl?: string): Promise<RDFDocument> {
        return this.documentsCache.get(json)
            ?? await this.getFromJsonLD(json, baseUrl);
    }

    public static reduceJsonLDGraph(json: JsonLDGraph, resourceId: string): JsonLDGraph {
        return tap({ '@graph': json['@graph'].filter(resource => resource['@id'] !== resourceId) }, reducedJson => {
            const document = this.documentsCache.get(json);

            if (!document) {
                return;
            }

            this.cacheJsonLD(reducedJson, document.clone({ removeResourceUrls: [resourceId] }));
        });
    }

    private static cacheJsonLD(json: JsonLD, document: RDFDocument): void {
        this.documentsCache.set(json, document);
    }

    private static async getFromJsonLD(json: JsonLD, baseUrl?: string): Promise<RDFDocument> {
        const quads = await toRDF(json, baseUrl);

        return tap(new RDFDocument(json['@id'] ? urlRoute(json['@id']) : null, quads), document => {
            this.documentsCache.set(json, document);
        });
    }

    public readonly url: string | null;
    public readonly metadata: RDFDocumentMetadata;
    public statements: Quad[];
    public resourcesIndex: Record<string, RDFResource>;
    public properties: RDFResourceProperty[];
    public resources: RDFResource[];

    constructor(url: string | null, statements: Quad[] = [], metadata: RDFDocumentMetadata = {}) {
        this.url = url;
        this.statements = statements;
        this.metadata = metadata;

        this.resourcesIndex = this.statements.reduce((resourcesIndex, statement) => {
            const resourceUrl = statement.subject.value;
            const resource = resourcesIndex[resourceUrl] = resourcesIndex[resourceUrl] ?? new RDFResource(resourceUrl);

            resource.addStatement(statement);

            return resourcesIndex;
        }, {} as Record<string, RDFResource>);

        this.resources = Object.values(this.resourcesIndex);

        this.properties = this.resources.reduce(
            (properties, resource) => properties.concat(resource.properties),
            [] as RDFResourceProperty[],
        );
    }

    public isEmpty(): boolean {
        return this.statements.length === 0;
    }

    public hasProperty(resourceUrl: string, name: string): boolean {
        const resource = this.resourcesIndex[resourceUrl];

        return !!resource && name in resource.propertiesIndex;
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

    public clone(options: Partial<CloneOptions> = {}): RDFDocument {
        return tap(new RDFDocument(options.changeUrl ?? this.url, [], this.metadata), document => {
            const removeResourceUrls = options.removeResourceUrls;

            if (!removeResourceUrls) {
                document.statements = this.statements.slice(0);
                document.properties = this.properties.slice(0);
                document.resources = this.resources.slice(0);
                document.resourcesIndex = { ...this.resourcesIndex };

                return;
            }

            document.statements = this.statements.filter(
                statement => !removeResourceUrls.includes(statement.subject.value),
            );
            document.properties = this.properties.filter(
                property => !property.resourceUrl || !removeResourceUrls.includes(property.resourceUrl),
            );
            document.resources = this.resources.filter(
                resource => !removeResourceUrls.includes(resource.url),
            );
            document.resourcesIndex = objectMap(document.resources, 'url');
        });
    }

}

function getDescribedBy(options: TurtleParsingOptions): string | undefined {
    if (!options.headers?.has('Link'))
        return undefined;

    const matches = options.headers.get('Link')?.match(/<([^>]+)>; rel="describedBy"/i);

    if (!matches)
        return undefined;

    return urlResolve(options.baseUrl || '', matches[1] as string);
}
