import Soukai, { BelongsToManyRelation, SoukaiError, Attributes } from 'soukai';

import SolidEngine from '@/engines/SolidEngine';

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
        this.related = await this.relatedClass.from(this.parent.url).all<Related>({
            $in: this.parent.resourceUrls,
        });

        return this.related;
    }

    public async create(attributes: Attributes = {}): Promise<Related> {
        const model = this.relatedClass.newInstance<Related>(attributes);

        await this.save(model);

        return model;
    }

    public async save(model: Related): Promise<void> {
        if (!this.parent.exists())
            throw new SoukaiError("Cannot save a model because the container doesn't exist");

        await model.save(this.parent.url);

        if (!(Soukai.engine instanceof SolidEngine))
            await this.parent.update({
                resourceUrls: [...this.parent.resourceUrls, model.url],
            });

        if (this.loaded)
            this.related!.push(model);
    }

}
