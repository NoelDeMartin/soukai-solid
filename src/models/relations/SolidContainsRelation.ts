import { BelongsToManyRelation } from 'soukai';

import SolidContainerModel from '@/models/SolidContainerModel';
import SolidModel from '@/models/SolidModel';

export default class SolidContainsRelation<
    Parent extends SolidContainerModel = SolidContainerModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends typeof SolidModel = typeof SolidModel,
> extends BelongsToManyRelation<Parent, Related, RelatedClass> {

    public constructor(parent: Parent, relatedClass: RelatedClass) {
        super(parent, relatedClass, 'resourceUrls', 'url');
    }

    public async resolve(): Promise<Related[]> {
        // TODO this will only find models that have the same url as the document,
        // so things like https://example.org/my-document#it won't work

        this.related = await this.relatedClass.from(this.parent.url).all<Related>({
            $in: this.parent.resourceUrls,
        });

        return this.related;
    }

}
