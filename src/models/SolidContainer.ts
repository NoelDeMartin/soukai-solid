import {
    requireUrlParentDirectory,
    shortId,
    stringToSlug,
    urlDirectoryName,
    urlResolveDirectory,
    uuid,
} from '@noeldemartin/utils';
import { findContainerRegistrations } from '@noeldemartin/solid-utils';
import type { Relation } from 'soukai';

import { SolidEngine } from '@/engines';

import SolidContainerDocumentsRelation from './relations/SolidContainerDocumentsRelation';
import SolidContainsRelation from './relations/SolidContainsRelation';

import Model from './SolidContainer.schema';
import SolidTypeRegistration from './SolidTypeRegistration';
import type SolidDocument from './SolidDocument';
import type { SolidModel } from './SolidModel';
import type { SolidModelConstructor } from './inference';

export default class SolidContainer extends Model {

    public static async fromTypeIndex<T extends SolidContainer>(
        this: SolidModelConstructor<T>,
        typeIndexUrl: string,
        childrenModelClass: typeof SolidModel,
    ): Promise<T[]> {
        const engine = this.requireFinalEngine();
        const fetch = engine instanceof SolidEngine ? engine.getFetch() : undefined;
        const urls = await findContainerRegistrations(
            typeIndexUrl,
            childrenModelClass.rdfsClasses,
            fetch,
        );

        return urls.map(url => this.newInstance({ url }, true));
    }

    public documents!: SolidDocument[];
    public relatedDocuments!: SolidContainerDocumentsRelation;

    public documentsRelationship(): Relation {
        return new SolidContainerDocumentsRelation(this);
    }

    public async register(typeIndexUrl: string, childrenModelClass: typeof SolidModel): Promise<void> {
        const typeRegistration = new SolidTypeRegistration({
            forClass: childrenModelClass.rdfsClasses[0],
            instanceContainer: this.url,
        });

        typeRegistration.mintUrl(typeIndexUrl, true, uuid());

        await typeRegistration.withEngine(
            this.requireEngine(),
            () => typeRegistration.save(requireUrlParentDirectory(typeIndexUrl)),
        );
    }

    protected contains<T extends typeof SolidModel>(model: T): SolidContainsRelation {
        return new SolidContainsRelation(this, model);
    }

    protected newUrl(): string {
        const slug = this.hasAttribute('name') ? stringToSlug(this.getAttribute('name')) || uuid() : uuid();

        return urlResolveDirectory(this.static('collection'), slug);
    }

    protected newUniqueUrl(url?: string): string {
        url = url ?? this.newUrl();

        const directoryName = urlDirectoryName(url);

        return urlResolveDirectory(requireUrlParentDirectory(url), `${directoryName}-${shortId()}`);
    }

}
