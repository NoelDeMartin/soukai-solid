import { SingleModelRelation } from 'soukai';
import { requireUrlParentDirectory } from '@noeldemartin/utils';

import type { SolidModel } from '@/models/SolidModel';

import type { SolidContainerModelConstructor } from '@/models/inference';
import type SolidContainerModel from '@/models/SolidContainerModel';

export default class SolidIsContainedByRelation<
    Parent extends SolidModel = SolidModel,
    Related extends SolidContainerModel = SolidContainerModel,
    RelatedClass extends SolidContainerModelConstructor<Related> = SolidContainerModelConstructor<Related>,
> extends SingleModelRelation<Parent, Related, RelatedClass> {

    public constructor(parent: Parent, relatedClass: RelatedClass) {
        super(parent, relatedClass, 'url');
    }

    public isEmpty(): false {
        return false;
    }

    public async resolve(): Promise<Related | null> {
        const oldCollection = this.relatedClass.collection;
        const containerUrl = requireUrlParentDirectory(this.parent.url);

        this.related = await this.relatedClass
            .from(requireUrlParentDirectory(containerUrl))
            .find(containerUrl);

        this.relatedClass.collection = oldCollection;

        return this.related;
    }

    protected initializeInverse(parent: Parent, related: Related): void {
        this.related = related;
    }

}
