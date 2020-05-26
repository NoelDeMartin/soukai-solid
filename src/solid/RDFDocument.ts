import { Quad } from 'rdf-js';

import RDF from '@/solid/utils/RDF';
import RDFResource from '@/solid/RDFResource';
import RDFResourceProperty from '@/solid/RDFResourceProperty';

export default class RDFDocument {

    public readonly url: string;
    public readonly statements: Quad[];
    public readonly resourcesIndex: MapObject<RDFResource>;

    constructor(url: string, statements: Quad[]) {
        this.url = url;
        this.statements = statements;
        this.resourcesIndex = {};

        for (const statement of statements) {
            const resourceUrl = statement.subject.value;

            if (!(resourceUrl in this.resourcesIndex))
                this.resourcesIndex[resourceUrl] = new RDFResource(resourceUrl);

            this.resourcesIndex[resourceUrl].addStatement(statement);
        }
    }

    public get properties(): RDFResourceProperty[] {
        return this.resources.reduce(
            (properties, resource) => [...properties, ...resource.properties],
            [],
        );
    }

    public get resources(): RDFResource[] {
        return Object.values(this.resourcesIndex);
    }

    public get rootResource(): RDFResource {
        return this.resources[0];
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

}
