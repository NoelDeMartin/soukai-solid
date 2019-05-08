import { Model, MultipleModelsRelation } from 'soukai';

import SolidModel from '@/models/SolidModel';

import Url from '@/utils/Url';

export default class SolidHasManyRelation extends MultipleModelsRelation {

    protected linksField: string;

    protected related: typeof SolidModel;

    public constructor(parent: SolidModel, related: typeof SolidModel, linksField: string) {
        super(parent, related);

        this.linksField = linksField;
    }

    public async resolve(): Promise<Model[]> {
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
                containerUrl => this.related.from(containerUrl).all({
                    $in: linksByContainerUrl[containerUrl],
                }),
            ),
        );

        return results.reduce(
            (models: SolidModel[], containerModels: SolidModel[]) => {
                models.push(...containerModels);

                return models;
            },
            [],
        );
    }

}
