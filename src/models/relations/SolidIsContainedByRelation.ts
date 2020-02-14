import { SingleModelRelation } from 'soukai';

import SolidModel from '@/models/SolidModel';
import Url from '@/utils/Url';

export default class SolidIsContainedByRelation<
    P extends SolidModel = SolidModel,
    R extends SolidModel = SolidModel,
    RC extends typeof SolidModel = typeof SolidModel,
> extends SingleModelRelation<P, R, RC> {

    public resolve(): Promise<R | null> {
        const oldCollection = this.related.collection;

        const containerUrl = Url.parentDirectory(this.parent.url);

        const result = this.related
            .from(Url.parentDirectory(containerUrl))
            .find<R>(containerUrl);

        this.related.collection = oldCollection;

        return result;
    }

}
