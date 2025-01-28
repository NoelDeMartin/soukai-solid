import {
    arrayFrom,
    requireUrlParentDirectory,
    shortId,
    urlDirectoryName,
    urlResolveDirectory,
    uuid,
} from '@noeldemartin/utils';
import { findContainerRegistrations } from '@noeldemartin/solid-utils';
import type { ModelConstructor, Relation } from 'soukai';

import { LDP_CONTAINS } from '@/solid/constants';
import { SolidEngine } from '@/engines/SolidEngine';

import SolidContainerDocumentsRelation from './relations/SolidContainerDocumentsRelation';
import SolidContainsRelation from './relations/SolidContainsRelation';

import Model from './SolidContainer.schema';
import SolidTypeRegistration from './SolidTypeRegistration';
import type SolidDocument from './SolidDocument';
import type SolidTypeIndex from './SolidTypeIndex';
import type { SolidModel } from './SolidModel';
import type { SolidContainerConstructor, SolidModelConstructor } from './inference';

export default class SolidContainer extends Model {

    public static defaultResourceHash = null;

    public static boot(name?: string): void {
        super.boot(name);

        this.slugField = this.slugField ?? 'name';
    }

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

    protected markAttributeDirty(field: string, originalValue: unknown, newValue: unknown): boolean {
        if (field === 'resourceUrls' && this.usingSolidEngine()) {
            return false;
        }

        return super.markAttributeDirty(field, originalValue, newValue);
    }

    public async register(
        typeIndex: string | SolidTypeIndex,
        childrenModelClasses: typeof SolidModel | Array<typeof SolidModel>,
    ): Promise<void> {
        const typeRegistration = new SolidTypeRegistration({
            forClass: arrayFrom(childrenModelClasses).map(modelClass => modelClass.rdfsClasses).flat(),
            instanceContainer: this.url,
        });

        if (typeof typeIndex === 'string') {
            typeRegistration.mintUrl(typeIndex, true, uuid());

            await typeRegistration.withEngine(
                this.requireEngine(),
                () => typeRegistration.save(requireUrlParentDirectory(typeIndex)),
            );

            return;
        }

        await typeIndex.withEngine(this.requireEngine(), async () => {
            await typeIndex.loadRelationIfUnloaded('registrations');
            await typeIndex.relatedRegistrations.create(typeRegistration);
        });
    }

    public static(): SolidContainerConstructor<this>;
    public static<T extends keyof SolidContainerConstructor<this>>(property: T): SolidContainerConstructor<this>[T];
    public static<T extends keyof SolidContainerConstructor<this>>(property?: T): SolidContainerConstructor<this>[T] {
        return super.static(property as keyof ModelConstructor<this>);
    }

    protected contains<T extends typeof SolidModel>(model: T): SolidContainsRelation {
        return new SolidContainsRelation(this, model);
    }

    protected newUrl(): string {
        return urlResolveDirectory(this.newUrlDocumentUrl());
    }

    protected newUniqueUrl(url?: string): string {
        url = url ?? this.newUrl();

        const directoryName = urlDirectoryName(url);

        return urlResolveDirectory(requireUrlParentDirectory(url), `${directoryName}-${shortId()}`);
    }

    protected ignoreRdfPropertyHistory(rdfProperty: string): boolean {
        return this.usingSolidEngine() && rdfProperty === LDP_CONTAINS;
    }

}
