import { arrayUnique, requireUrlParentDirectory, urlParentDirectory, urlRoot } from '@noeldemartin/utils';
import { SingleModelRelation } from 'soukai';

import type { SolidModel } from '@/models/SolidModel';

import type SolidContainer from '@/models/SolidContainer';
import type { SolidContainerConstructor } from '@/models/inference';

export default class SolidIsContainedByRelation<
    Parent extends SolidModel = SolidModel,
    Related extends SolidContainer = SolidContainer,
    RelatedClass extends SolidContainerConstructor<Related> = SolidContainerConstructor<Related>,
> extends SingleModelRelation<Parent, Related, RelatedClass> {

    public constructor(parent: Parent, relatedClass: RelatedClass) {
        super(parent, relatedClass, 'resourceUrls', 'url');
    }

    public isEmpty(): false {
        return false;
    }

    public setForeignAttributes(related: Related): void {
        if (!this.parent.url)
            return;

        related.resourceUrls = arrayUnique([
            ...related.resourceUrls,
            this.parent.url,
        ]);
    }

    public async load(): Promise<Related | null> {
        const oldCollection = this.relatedClass.collection;
        const containerUrl = requireUrlParentDirectory(this.parent.url);

        this.related = await this.relatedClass
            .from(urlParentDirectory(containerUrl) ?? urlRoot(containerUrl))
            .find(containerUrl);

        this.relatedClass.collection = oldCollection;

        return this.related;
    }

}
