import { BelongsToManyRelation } from 'soukai';

import SolidModel from '@/models/SolidModel';

import Url from '@/utils/Url';

export default class SolidBelongsToManyRelation<
    Parent extends SolidModel = SolidModel,
    Related extends SolidModel = SolidModel,
    RelatedClass extends typeof SolidModel = typeof SolidModel,
> extends BelongsToManyRelation<Parent, Related, RelatedClass> {

    public async resolve(): Promise<Related[]> {
        if (this.localKeyName !== this.relatedClass.primaryKey)
            return super.resolve();

        const ids = this.parent.getAttribute(this.foreignKeyName);
        const idsByContainerUrl = {};

        for (const id of ids) {
            const containerUrl = Url.parentDirectory(id);

            if (!(containerUrl in idsByContainerUrl)) {
                idsByContainerUrl[containerUrl] = [];
            }

            idsByContainerUrl[containerUrl].push(id);
        }

        const results = await Promise.all(
            Object.keys(idsByContainerUrl).map(
                containerUrl => this.relatedClass.from(containerUrl).all<Related>({
                    $in: idsByContainerUrl[containerUrl],
                }),
            ),
        );

        this.related = results.reduce(
            (models: Related[], containerModels: Related[]) => {
                models.push(...containerModels);

                return models;
            },
            [],
        );

        return this.related;
    }

}
