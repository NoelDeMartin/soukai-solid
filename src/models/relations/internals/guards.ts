import type { Relation } from 'soukai';

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
    return 'add' in relation;
}

export function isSolidSingleModelDocumentRelation(
    relation: Relation,
): relation is SolidSingleModelDocumentRelationInstance {
    return 'set' in relation;
}
