import { Model, MultiModelRelation } from 'soukai';

import SolidModel from '@/models/SolidModel';

export default class SolidEmbedsRelation<
    P extends SolidModel = SolidModel,
    R extends SolidModel = SolidModel,
    RC extends typeof SolidModel = typeof SolidModel,
> extends MultiModelRelation<P, R, RC> {

    public async resolve(): Promise<R[]> {
        return this.related.from(this.parent.url).all();
    }

}
