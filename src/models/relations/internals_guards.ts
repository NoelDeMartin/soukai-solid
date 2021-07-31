import type { Relation } from 'soukai';

import SolidBelongsToManyRelation from './SolidBelongsToManyRelation';
import SolidHasManyRelation from './SolidHasManyRelation';
import SolidHasOneRelation from './SolidHasOneRelation';

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
