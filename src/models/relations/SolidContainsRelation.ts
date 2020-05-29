import { BelongsToManyRelation } from 'soukai';

import SolidContainerModel from '@/models/SolidContainerModel';
import SolidModel from '@/models/SolidModel';

import Arr from '@/utils/Arr';
import Cache from '@/utils/Cache';

export default class SolidContainsRelation<
    Parent extends SolidContainerModel = SolidContainerModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends typeof SolidModel = typeof SolidModel,
> extends BelongsToManyRelation<Parent, Related, RelatedClass> {

    private useCache: boolean;

    public constructor(parent: Parent, relatedClass: RelatedClass, useCache: boolean = true) {
        super(parent, relatedClass, 'resourceUrls', 'url');

        this.useCache = useCache;
    }

    public async resolve(): Promise<Related[]> {
        const relatedUrls = this.parent.resourceUrls;
        const cachedModels = await this.getCachedModels();
        const updatedModels = await this.relatedClass.from(this.parent.url).all<Related>({
            $in: Arr.without(relatedUrls, cachedModels.map(model => model.url)),
        });

        await this.cacheModels(updatedModels);

        this.related = [...cachedModels, ...updatedModels];

        return this.related;
    }

    private async getCachedModels(): Promise<Related[]> {
        if (!this.useCache)
            return [];

        const modelsAttributes = await Promise.all(this.parent.documents.map(async document => {
            const updatedAt = await Cache.get(document.url + '-updatedAt');

            if (updatedAt === document.updatedAt.toISOString())
                return Cache.get(document.url);

            if (updatedAt !== null) {
                Cache.delete(document.url);
                Cache.delete(document.url + '-updatedAt');
            }

            return null;
        }));

        return modelsAttributes
            .filter(model => model !== null)
            .map(attributes => new this.relatedClass(attributes, true) as Related);
    }

    private async cacheModels(models: Related[]): Promise<void> {
        if (!this.useCache)
            return;

        const modelsMap: MapObject<Related> = models.reduce((map, model) => {
            map[model.url] = model;

            return map;
        }, {});

        await Promise.all(this.parent.documents.map(async document => {
            if (!(document.url in modelsMap))
                return;

            await Cache.set(document.url, modelsMap[document.url].getAttributes());
            await Cache.set(document.url + '-updatedAt', document.updatedAt.toISOString());
        }));
    }

}
