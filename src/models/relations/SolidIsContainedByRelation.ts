import { SingleModelRelation } from 'soukai';

import SolidModel from '@/models/SolidModel';
import Url from '@/utils/Url';

export default class SolidIsContainedByRelation extends SingleModelRelation {

    protected related: typeof SolidModel;

    public constructor(parent: SolidModel, related: typeof SolidModel) {
        super(parent, related);
    }

    public resolve(): Promise<SolidModel | null> {
        const oldCollection = this.related.collection;

        const containerUrl = Url.parentDirectory(this.parent.url);

        const result = this.related
            .from(Url.parentDirectory(containerUrl))
            .find<SolidModel>(containerUrl);

        this.related.collection = oldCollection;

        return result;
    }

}
