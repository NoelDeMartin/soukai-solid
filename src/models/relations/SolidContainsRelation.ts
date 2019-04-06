import { MultipleModelsRelation } from 'soukai';

import SolidModel from '@/models/SolidModel';

export default class SolidContainsRelation extends MultipleModelsRelation {

    protected related: typeof SolidModel;

    public constructor(parent: SolidModel, related: typeof SolidModel) {
        super(parent, related);
    }

    public resolve(): Promise<SolidModel[]> {
        const oldCollection = this.related.collection;

        const results = this.related.from(this.parent.url).all<SolidModel>();

        this.related.collection = oldCollection;

        return results;
    }

}
