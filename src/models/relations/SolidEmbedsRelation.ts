import { MultiModelRelation, Attributes, Documents, EngineHelper } from 'soukai';

import SolidModel from '@/models/SolidModel';

export default class SolidEmbedsRelation<
    P extends SolidModel = SolidModel,
    R extends SolidModel = SolidModel,
    RC extends typeof SolidModel = typeof SolidModel,
> extends MultiModelRelation<P, R, RC> {

    public async resolve(): Promise<R[]> {
        return this.related.from(this.parent.url).all();
    }

    public save(model: R): Promise<R> {
        return model.save(this.parent.url);
    }

    public create(attributes: Attributes): Promise<R> {
        // TODO refactor relations so that models are stored in the relation instance,
        // not in the model. Doing that, operations such as this can add new models to the
        // array of loaded models.

        return this.save(new this.related(attributes) as R);
    }

    public resolveFromDocuments(documents: Documents): R[] {
        const engineHelper = new EngineHelper();
        const filters = this.related.prepareEngineFilters();

        return Object
            .entries(engineHelper.filterDocuments(documents, filters))
            .map(([id, attributes]) => this.related.instance.fromEngineAttributes(id, attributes));
    }

}
