import type { Relation } from 'soukai';

import SolidBelongsToManyRelation from '@/models/relations/SolidBelongsToManyRelation';
import SolidHasManyRelation from '@/models/relations/SolidHasManyRelation';
import SolidHasOneRelation from '@/models/relations/SolidHasOneRelation';

export function hasBeforeParentCreateHook(
    relation: Relation,
): relation is Relation & { __beforeParentCreate(): void } {
    return '__beforeParentCreate' in relation
        && typeof (relation as unknown as { __beforeParentCreate: unknown })['__beforeParentCreate'] === 'function';
}

export function isSolidSingleModelRelation(relation: Relation): relation is SolidHasOneRelation {
    return relation instanceof SolidHasOneRelation;
}

export function isSolidMultiModelRelation(
    relation: Relation,
): relation is SolidHasManyRelation | SolidBelongsToManyRelation {
    return relation instanceof SolidHasManyRelation ||
        relation instanceof SolidBelongsToManyRelation;
}
