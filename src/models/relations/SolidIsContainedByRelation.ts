import { SingleModelRelation } from 'soukai';

import type { SolidModel } from '@/models/SolidModel';

import Url from '@/utils/Url';
import type { SolidContainerModelConstructor, SolidModelConstructor } from '@/models/inference';
import type SolidContainerModel from '@/models/SolidContainerModel';

export default class SolidIsContainedByRelation<
    Parent extends SolidModel = SolidModel,
    Related extends SolidContainerModel = SolidContainerModel,
    RelatedClass extends SolidContainerModelConstructor<Related> = SolidModelConstructor<Related>,
> extends SingleModelRelation<Parent, Related, RelatedClass> {

    public constructor(parent: Parent, relatedClass: RelatedClass) {
        super(parent, relatedClass, 'url');
    }

    public async resolve(): Promise<Related | null> {
        const oldCollection = this.relatedClass.collection;
        const containerUrl = Url.parentDirectory(this.parent.url);

        this.related = await this.relatedClass
            .from(Url.parentDirectory(containerUrl))
            .find(containerUrl);

        this.relatedClass.collection = oldCollection;

        return this.related;
    }

}
