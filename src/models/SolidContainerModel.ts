import { FieldType, MultiModelRelation } from 'soukai';

import { IRI } from '@/solid/utils/RDF';

import Str from '@/utils/Str';
import Url from '@/utils/Url';
import UUID from '@/utils/UUID';

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

    public documentsRelationship(): MultiModelRelation {
        return this.belongsToMany(SolidDocument, 'resourceUrls');
    }

    protected contains(model: typeof SolidModel): MultiModelRelation {
        return new SolidContainsRelation(this, model);
    }

    protected initializeRelations() {
        super.initializeRelations();

        this._relations['documents'].related = [];
    }

    protected newUrl(): string {
        return Url.resolveDirectory(
            this.modelClass.collection,
            this.hasAttribute('name')
                ? Str.slug(this.getAttribute('name'))
                : UUID.generate(),
        );
    }

}
