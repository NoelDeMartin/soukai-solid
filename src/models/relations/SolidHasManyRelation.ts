import { Model, MultipleModelsRelation } from 'soukai';
import SolidModel from '@/models/SolidModel';

export default class SolidHasManyRelation extends MultipleModelsRelation {

    protected linksField: string;

    public constructor(parent: SolidModel, related: typeof SolidModel, linksField: string) {
        super(parent, related);

        this.linksField = linksField;
    }

    public resolve(): Promise<Model[]> {
        return this.related.all({ $in: this.parent.getAttribute(this.linksField) });
    }

}
