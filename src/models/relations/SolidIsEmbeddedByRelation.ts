import { SingleModelRelation } from 'soukai';

import SolidModel from '@/models/SolidModel';
import Url from '@/utils/Url';

export default class SolidIsEmbeddedByRelation<
    P extends SolidModel = SolidModel,
    R extends SolidModel = SolidModel,
    RC extends typeof SolidModel = typeof SolidModel,
> extends SingleModelRelation<P, R, RC> {

    public resolve(): Promise<R | null> {
        const oldCollection = this.related.collection;

        const parentUrl = Url.clean(this.parent.url, { fragment: false });

        const result = this.related
            .from(Url.parentDirectory(parentUrl))
            .find<R>(parentUrl);

        this.related.collection = oldCollection;

        return result;
    }

}
