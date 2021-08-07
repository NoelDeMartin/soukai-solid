import type { Relation } from 'soukai';

import SolidHasOneRelation from '@/models/relations/SolidHasOneRelation';
import type {
    // eslint-fix
    SolidMultiModelDocumentRelationInstance,
} from '@/models/relations/mixins/SolidMultiModelDocumentRelation';
import type {
    // eslint-fix
    SolidSingleModelDocumentRelationInstance,
} from '@/models/relations/mixins/SolidSingleModelDocumentRelation';

interface BeforeParentCreateRelation extends Relation {
    __beforeParentCreate(): void;
}

export function hasBeforeParentCreateHook(relation: Relation): relation is BeforeParentCreateRelation {
    return '__beforeParentCreate' in relation;
}

export function isSolidDocumentRelation(
    relation: Relation,
): relation is SolidMultiModelDocumentRelationInstance | SolidSingleModelDocumentRelationInstance {
    return isSolidSingleModelDocumentRelation(relation)
        || isSolidMultiModelDocumentRelation(relation);
}

export function isSolidMultiModelDocumentRelation(
    relation: Relation,
): relation is SolidMultiModelDocumentRelationInstance {
    return '__loadDocumentModels' in relation;
}

export function isSolidSingleModelDocumentRelation(
    relation: Relation,
): relation is SolidSingleModelDocumentRelationInstance {
    return relation instanceof SolidHasOneRelation;
}
