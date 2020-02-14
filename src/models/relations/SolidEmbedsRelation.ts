import { MultiModelRelation, Attributes } from 'soukai';

import SolidModel from '@/models/SolidModel';

export default class SolidEmbedsRelation<
    P extends SolidModel = SolidModel,
    R extends SolidModel = SolidModel,
    RC extends typeof SolidModel = typeof SolidModel,
> extends MultiModelRelation<P, R, RC> {

    public async resolve(): Promise<R[]> {
        return this.related.from(this.parent.url).all();
    }

    public async create(attributes: Attributes): Promise<R> {
        // TODO refactor relations so that models are stored in the relation instance,
        // not in the model. Doing that, operations such as this can add new models to the
        // array of loaded models.

        return this.related.at(this.parent.url).create(attributes);
    }

}
