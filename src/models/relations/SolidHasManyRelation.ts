import { Model, MultiModelRelation } from 'soukai';

import SolidModel from '@/models/SolidModel';

import Url from '@/utils/Url';

export default class SolidHasManyRelation<
    P extends SolidModel = SolidModel,
    R extends SolidModel = SolidModel,
    RC extends typeof SolidModel = typeof SolidModel,
> extends MultiModelRelation<P, R, RC> {

    protected linksField: string;

    public constructor(parent: P, related: RC, linksField: string) {
        super(parent, related);

        this.linksField = linksField;
    }

    public async resolve(): Promise<R[]> {
        const links = this.parent.getAttribute(this.linksField);
        const linksByContainerUrl = {};

        for (const link of links) {
            const containerUrl = Url.parentDirectory(link);

            if (!(containerUrl in linksByContainerUrl)) {
                linksByContainerUrl[containerUrl] = [];
            }

            linksByContainerUrl[containerUrl].push(link);
        }

        const results = await Promise.all(
            Object.keys(linksByContainerUrl).map(
                containerUrl => this.related.from(containerUrl).all<R>({
                    $in: linksByContainerUrl[containerUrl],
                }),
            ),
        );

        return results.reduce(
            (models: R[], containerModels: R[]) => {
                models.push(...containerModels);

                return models;
            },
            [],
        );
    }

}
