import { usesMixin } from '@noeldemartin/utils';
import type { Relation } from 'soukai';

import SolidBelongsToRelation from '@/models/relations/mixins/SolidBelongsToRelation';
import SolidHasRelation from '@/models/relations/mixins/SolidHasRelation';
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
import type { SolidDocumentRelationInstance } from '@/models/relations/mixins/SolidDocumentRelation';

interface BeforeParentCreateRelation extends Relation {
    __beforeParentCreate(): void;
}

export function hasBeforeParentCreateHook(relation: Relation): relation is BeforeParentCreateRelation {
    return '__beforeParentCreate' in relation;
}

export function isSolidDocumentRelation(
    relation: Relation,
): relation is SolidDocumentRelationInstance {
    return 'useSameDocument' in relation;
}

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

export function isSolidBelongsToRelation(relation: unknown): relation is SolidBelongsToRelation {
    return usesMixin(relation, SolidBelongsToRelation);
}

export function isSolidHasRelation(relation: unknown): relation is SolidHasRelation {
    return usesMixin(relation, SolidHasRelation);
}
