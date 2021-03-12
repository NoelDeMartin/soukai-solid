import { FieldType } from 'soukai';
import type { MultiModelRelation } from 'soukai';

import IRI from '@/solid/utils/IRI';

import Arr from '@/utils/Arr';
import Str from '@/utils/Str';
import Url from '@/utils/Url';
import UUID from '@/utils/UUID';

import SolidContainerDocumentsRelation from './relations/SolidContainerDocumentsRelation';
import SolidContainsRelation from './relations/SolidContainsRelation';

import { SolidModel } from './SolidModel';
import type SolidDocument from './SolidDocument';

export default class SolidContainerModel extends SolidModel {

    public static boot(name: string): void {
        const modelClass = this;

        // Add container definitions.
        modelClass.rdfsClasses = Arr.unique((modelClass.rdfsClasses ?? []).concat([IRI('ldp:Container')]));
        modelClass.fields = modelClass.fields ?? {};
        modelClass.fields['resourceUrls'] = {
            type: FieldType.Array,
            required: false,
            rdfProperty: IRI('ldp:contains'),
            items: {
                type: FieldType.Key,
            },
        };

        // Boot model.
        super.boot(name);
    }

    resourceUrls!: string[];
    documents!: SolidDocument[];
    relatedDocuments!: MultiModelRelation<SolidContainerModel, SolidDocument, typeof SolidDocument>;

    public documentsRelationship(): MultiModelRelation {
        return new SolidContainerDocumentsRelation(this);
    }

    public async save(collection?: string): Promise<this> {
        await super.save(collection);

        if (this.wasRecentlyCreated() && !this.isRelationLoaded('documents'))
            this.setRelationModels('documents', []);

        return this;
    }

    protected contains<T extends typeof SolidModel>(model: T): MultiModelRelation {
        return new SolidContainsRelation(this, model);
    }

    protected newUrl(): string {
        const slug = this.hasAttribute('name') ? Str.slug(this.getAttribute('name')) : UUID.generate();

        return Url.resolveDirectory(this.static('collection'), slug);
    }

    protected newUniqueUrl(url?: string): string {
        url = url ?? this.newUrl();

        const uuid = UUID.generate();
        const directoryName = Url.directoryName(url);

        return Url.resolveDirectory(Url.parentDirectory(url), `${directoryName}-${uuid}`);
    }

}
