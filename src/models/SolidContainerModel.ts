import {
    stringToSlug,
    urlDirectoryName,
    urlParentDirectory,
    urlResolveDirectory,
    uuid,
} from '@noeldemartin/utils';
import { FieldType } from 'soukai';
import { findContainerRegistration } from '@noeldemartin/solid-utils';
import type { IModel , MultiModelRelation } from 'soukai';

import { SolidEngine } from '@/engines';

import SolidContainerDocumentsRelation from './relations/SolidContainerDocumentsRelation';
import SolidContainsRelation from './relations/SolidContainsRelation';

import { SolidModel } from './SolidModel';
import SolidTypeRegistration from './SolidTypeRegistration';
import type SolidDocument from './SolidDocument';
import type { SolidModelConstructor } from './inference';

export default class SolidContainerModel extends SolidModel {

    public static rdfsClasses = ['ldp:Container'];

    public static timestamps = false;

    public static fields = {
        name: {
            type: FieldType.String,
            rdfProperty: 'rdfs:label',
        },
        resourceUrls: {
            type: FieldType.Array,
            rdfProperty: 'ldp:contains',
            items: FieldType.Key,
        },
    };

    public static async fromTypeIndex<T extends SolidContainerModel>(
        this: SolidModelConstructor<T>,
        typeIndexUrl: string,
        childrenModelClass: typeof SolidModel,
    ): Promise<T | null> {
        const engine = this.requireEngine();
        const fetch = engine instanceof SolidEngine ? engine.getFetch() : undefined;
        const containerRegistration = await findContainerRegistration(
            typeIndexUrl,
            childrenModelClass.rdfsClasses[0],
            fetch,
        );

        if (!containerRegistration)
            return null;

        const attributes = {
            url: containerRegistration.value('solid:instanceContainer'),
            name: containerRegistration.value('rdfs:label'),
        };

        return this.newInstance(attributes, true);
    }

    public resourceUrls!: string[];
    public documents!: SolidDocument[];
    public relatedDocuments!: MultiModelRelation<SolidContainerModel, SolidDocument, typeof SolidDocument>;

    public documentsRelationship(): MultiModelRelation {
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
            () => typeRegistration.save(urlParentDirectory(typeIndexUrl)),
        );
    }

    protected contains<T extends typeof SolidModel>(model: T): MultiModelRelation {
        return new SolidContainsRelation(this, model);
    }

    protected newUrl(): string {
        const slug = this.hasAttribute('name') ? stringToSlug(this.getAttribute('name')) : uuid();

        return urlResolveDirectory(this.static('collection'), slug);
    }

    protected newUniqueUrl(url?: string): string {
        url = url ?? this.newUrl();

        const directoryName = urlDirectoryName(url);

        return urlResolveDirectory(urlParentDirectory(url), `${directoryName}-${uuid()}`);
    }

}

export default interface SolidContainerModel extends IModel<typeof SolidContainerModel> {}
