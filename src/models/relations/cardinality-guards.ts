import { usesMixin } from '@noeldemartin/utils';
import type { Relation } from 'soukai';

import SolidMultiModelDocumentRelation from '@/models/relations/mixins/SolidMultiModelDocumentRelation';
import SolidSingleModelDocumentRelation from '@/models/relations/mixins/SolidSingleModelDocumentRelation';
import type {
    // eslint-fix
    SolidMultiModelDocumentRelationInstance,
} from '@/models/relations/mixins/SolidMultiModelDocumentRelation';
import type {
    // eslint-fix
    SolidSingleModelDocumentRelationInstance,
} from '@/models/relations/mixins/SolidSingleModelDocumentRelation';

export function isSolidMultiModelDocumentRelation(
    relation: Relation,
): relation is SolidMultiModelDocumentRelationInstance {
    return usesMixin(relation, SolidMultiModelDocumentRelation);
}

export function isSolidSingleModelDocumentRelation(
    relation: Relation,
): relation is SolidSingleModelDocumentRelationInstance {
    return usesMixin(relation, SolidSingleModelDocumentRelation);
}
