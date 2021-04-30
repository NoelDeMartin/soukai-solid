import { BelongsToManyRelation, SoukaiError } from 'soukai';
import type { Attributes } from 'soukai';

import { SolidEngine } from '@/engines/SolidEngine';

import type SolidContainerModel from '@/models/SolidContainerModel';
import type { SolidModel } from '@/models/SolidModel';
import type { SolidModelConstructor } from '@/models/inference';

export default class SolidContainsRelation<
    Parent extends SolidContainerModel = SolidContainerModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends SolidModelConstructor<Related> = SolidModelConstructor<Related>,
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

    public async save(model: Related): Promise<Related> {
        if (!this.parent.exists())
            throw new SoukaiError('Cannot save a model because the container doesn\'t exist');

        await model.save(this.parent.url);

        if (!(this.parent.requireEngine() instanceof SolidEngine))
            await this.parent.update({
                resourceUrls: [...this.parent.resourceUrls, model.getDocumentUrl()],
            });

        if (this.loaded)
            this.related?.push(model);

        return model;
    }

}
