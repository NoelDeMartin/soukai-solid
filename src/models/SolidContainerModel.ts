import { FieldType, Model, MultiModelRelation } from 'soukai';

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

    public documentsRelationship(): MultiModelRelation {
        return new SolidContainerDocumentsRelation(this);
    }

    public async save<T extends Model>(collection?: string): Promise<T> {
        await super.save(collection);

        if (this.wasRecentlyCreated() && !this.isRelationLoaded('documents'))
            this.setRelationModels('documents', []);

        return this as unknown as T;
    }

    protected contains(model: typeof SolidModel): MultiModelRelation {
        return new SolidContainsRelation(this, model);
    }

    protected newUrl(): string {
        const slug = this.hasAttribute('name') ? Str.slug(this.getAttribute('name')) : UUID.generate();

        return Url.resolveDirectory(this.modelClass.collection, slug);
    }

    protected newUniqueUrl(url?: string): string {
        url = url ?? this.newUrl();

        const uuid = UUID.generate();
        const directoryName = Url.directoryName(url);

        return Url.resolveDirectory(Url.parentDirectory(url), `${directoryName}-${uuid}`);
    }

}
