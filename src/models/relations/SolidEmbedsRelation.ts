import { Model, MultiModelRelation } from 'soukai';

import SolidModel from '@/models/SolidModel';

export default class SolidEmbedsRelation extends MultiModelRelation {

    protected parent: SolidModel;

    protected related: typeof SolidModel;

    public async resolve(): Promise<Model[]> {
        return this.related.from(this.parent.url).all();
    }

}
