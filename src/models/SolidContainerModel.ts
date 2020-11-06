import { Attributes, FieldType, MultiModelRelation } from 'soukai';

import { IRI } from '@/solid/utils/RDF';

import Str from '@/utils/Str';
import Url from '@/utils/Url';
import UUID from '@/utils/UUID';

import SolidContainerDocumentsRelation from './relations/SolidContainerDocumentsRelation';
import SolidContainsRelation from './relations/SolidContainsRelation';

import SolidDocument from './SolidDocument';
import SolidModel from './SolidModel';

export default abstract class SolidContainerModel extends SolidModel {

    public static boot(name: string): void {
        super.boot(name);

        (this.rdfsClasses as Set<string>).add(IRI('ldp:Container'));

        this.fields['resourceUrls'] = {
            type: FieldType.Array,
            required: false,
            rdfProperty: 'http://www.w3.org/ns/ldp#contains',
            items: {
                type: FieldType.Key,
            },
        };

        SolidDocument.boot('SolidDocument');
    }

    resourceUrls: string[];

    documents: SolidDocument[];
    relatedDocuments: MultiModelRelation<SolidContainerModel, SolidDocument, typeof SolidDocument>;

    protected modificationDates: Date[] | null = null

    public documentsRelationship(): MultiModelRelation {
        return new SolidContainerDocumentsRelation(this);
    }

    protected contains(model: typeof SolidModel): MultiModelRelation {
        return new SolidContainsRelation(this, model);
    }

    protected newUrl(): string {
        const slug = this.hasAttribute('name') ? Str.slug(this.getAttribute('name')) : UUID.generate();

        return Url.resolveDirectory(this.modelClass.collection, slug);
    }

    protected initializeAttributes(attributes: Attributes, exists: boolean): void {
        // Container documents may have two updatedAt values, one returned from the LDP platform and one stored in
        // the meta document. We'll use the latest date.
        if (exists && 'updatedAt' in attributes && Array.isArray(attributes['updatedAt'])) {
            this.modificationDates = attributes['updatedAt'];

            attributes['updatedAt'] = attributes['updatedAt'].slice(1).reduce(
                (latest, current) => latest > current ? latest : current,
                attributes['updatedAt'][0],
            );
        }

        super.initializeAttributes(attributes, exists);

    }

}
