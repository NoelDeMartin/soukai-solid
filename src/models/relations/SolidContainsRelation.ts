import { arrayUnique } from '@noeldemartin/utils';
import { BelongsToManyRelation, SoukaiError } from 'soukai';
import type { Attributes } from 'soukai';

import { SolidEngine } from '@/engines/SolidEngine';

import type SolidContainer from '@/models/SolidContainer';
import type { SolidModel } from '@/models/SolidModel';
import type { SolidModelConstructor } from '@/models/inference';

export default class SolidContainsRelation<
    Parent extends SolidContainer = SolidContainer,
    Related extends SolidModel = SolidModel,
    RelatedClass extends SolidModelConstructor<Related> = SolidModelConstructor<Related>,
> extends BelongsToManyRelation<Parent, Related, RelatedClass> {

    public constructor(parent: Parent, relatedClass: RelatedClass) {
        super(parent, relatedClass, 'resourceUrls', 'url');
    }

    public setForeignAttributes(related: Related): void {
        if (!related.url)
            return;

        this.parent.resourceUrls = arrayUnique([
            ...this.parent.resourceUrls,
            related.url,
        ]);
    }

    public async load(): Promise<Related[]> {
        this.related = this.isEmpty()
            ? []
            : await this.relatedClass.from(this.parent.url).all<Related>({
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

        if (this.parent.requireFinalEngine() instanceof SolidEngine) {
            this.parent.setOriginalAttribute('resourceUrls', [...this.parent.resourceUrls, model.getDocumentUrl()]);
        } else {
            await this.parent.update({
                resourceUrls: [...this.parent.resourceUrls, model.getDocumentUrl()],
            });
        }

        if (this.loaded)
            this.related?.push(model);

        return model;
    }

}
