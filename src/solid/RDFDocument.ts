import { Quad } from 'rdf-js';

import RDF from '@/solid/utils/RDF';
import RDFResource from '@/solid/RDFResource';
import RDFResourceProperty from '@/solid/RDFResourceProperty';

export interface RDFDocumentMetadata {
    containsRelativeIRIs?: boolean;
    describedBy?: string;
}

export default class RDFDocument {

    public readonly url: string;
    public readonly statements: Quad[];
    public readonly metadata: RDFDocumentMetadata;
    public readonly resourcesIndex: MapObject<RDFResource>;
    public readonly properties: RDFResourceProperty[];
    public readonly resources: RDFResource[];

    constructor(url: string, statements: Quad[], metadata: RDFDocumentMetadata = {}) {
        this.url = url;
        this.statements = statements;
        this.metadata = metadata;

        this.resourcesIndex = this.statements.reduce((resourcesIndex, statement) => {
            const resourceUrl = statement.subject.value;

            if (!(resourceUrl in resourcesIndex))
                resourcesIndex[resourceUrl] = new RDFResource(resourceUrl);

            resourcesIndex[resourceUrl].addStatement(statement);

            return resourcesIndex;
        }, {});

        this.resources = Object.values(this.resourcesIndex);

        this.properties = this.resources.reduce(
            (properties, resource) => [...properties, ...resource.properties],
            [],
        );
    }

    public isEmpty(): boolean {
        return this.statements.length === 0;
    }

    public hasProperty(resourceUrl: string, name: string): boolean {
        return resourceUrl in this.resourcesIndex && name in this.resourcesIndex[resourceUrl].propertiesIndex;
    }

    public async toJsonLD(): Promise<object> {
        return RDF.createJsonLD(this.statements);
    }

    public resource(url: string): RDFResource | null {
        return this.resourcesIndex[url] ?? null;
    }

}
