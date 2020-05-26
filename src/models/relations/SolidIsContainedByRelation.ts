import { SingleModelRelation } from 'soukai';

import SolidModel from '@/models/SolidModel';

import Url from '@/utils/Url';

export default class SolidIsContainedByRelation<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends typeof SolidModel = typeof SolidModel,
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
