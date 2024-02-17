import { arrayUnique, tap } from '@noeldemartin/utils';
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
        if (!related.url) {
            return;
        }

        const resourceUrls = arrayUnique([...this.parent.resourceUrls, related.getDocumentUrl()]);

        if (this.parent.requireFinalEngine() instanceof SolidEngine) {
            this.parent.setOriginalAttribute('resourceUrls', resourceUrls);
        } else {
            this.parent.setAttribute('resourceUrls', resourceUrls);
        }
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
        return tap(this.attach(attributes), model => this.save(model));
    }

    public async save(model: Related): Promise<Related> {
        if (!this.parent.exists()) {
            throw new SoukaiError('Cannot save a model because the container doesn\'t exist');
        }

        return tap(model, async () => {
            await model.save(this.parent.url);
            await this.parent.save();
        });
    }

}
