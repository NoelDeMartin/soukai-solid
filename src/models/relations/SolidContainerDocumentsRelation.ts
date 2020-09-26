import Soukai from 'soukai';

import SolidBelongsToManyRelation from '@/models/relations/SolidBelongsToManyRelation';
import SolidContainerModel from '@/models/SolidContainerModel';
import SolidDocument from '@/models/SolidDocument';
import SolidEngine from '@/engines/SolidEngine';

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

    public async resolve(): Promise<SolidDocument[]> {
        if (Soukai.engine instanceof SolidEngine)
            return super.resolve();

        const documents = await Soukai.engine.readMany(this.container.getDocumentUrl()!);

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
