import { SolidEngine } from '@/engines/SolidEngine';
import SolidBelongsToManyRelation from '@/models/relations/SolidBelongsToManyRelation';
import SolidDocument from '@/models/SolidDocument';
import type SolidContainerModel from '@/models/SolidContainerModel';

interface GraphDocument {
    'purl:modified'?: { '@value': string };
    'http://purl.org/dc/terms/modified'?: { '@value': string };
    'purl:created'?: { '@value': string };
    'http://purl.org/dc/terms/created'?: { '@value': string };
}

export default class SolidContainerDocumentsRelation extends SolidBelongsToManyRelation<
    SolidContainerModel,
    SolidDocument,
    typeof SolidDocument
> {

    constructor(container: SolidContainerModel) {
        super(container, SolidDocument, 'resourceUrls');
    }

    public get container(): SolidContainerModel {
        return this.parent;
    }

    public async load(): Promise<SolidDocument[]> {
        const engine = this.parent.requireEngine();

        if (this.isEmpty())
            return this.related = [];

        if (engine instanceof SolidEngine) {
            return super.load();
        }

        // TODO this implementation can have serious performance issues for some engines.
        // Right now, there are only local engines other than Solid being used with Soukai,
        // so the problem is not as severe.
        const documents = await engine.readMany(this.container.requireDocumentUrl());

        this.related = Object.entries(documents).map(([url, document]) => new SolidDocument({
            url,
            updatedAt: this.getLatestUpdateDate(document['@graph'] as GraphDocument[]),
        }));

        return this.related;
    }

    private getLatestUpdateDate(documents: GraphDocument[]): Date {
        const latestUpdateTime = documents.reduce((latestUpdatedAt, document) => {
            const { '@value': dateValue } =
                document['purl:modified']
                ?? document['http://purl.org/dc/terms/modified']
                ?? document['purl:created']
                ?? document['http://purl.org/dc/terms/created']
                ?? { '@value': 0 };

            const documentUpdatedAt = new Date(dateValue).getTime();

            return Math.max(latestUpdatedAt, documentUpdatedAt);
        }, 0);

        return new Date(latestUpdateTime);
    }

}
