import { usesMixin } from '@noeldemartin/utils';
import type { Relation } from 'soukai';

import SolidBelongsToRelation from '@/models/relations/mixins/SolidBelongsToRelation';
import SolidHasRelation from '@/models/relations/mixins/SolidHasRelation';
import type { SolidDocumentRelationInstance } from '@/models/relations/mixins/SolidDocumentRelation';

interface BeforeParentCreateRelation extends Relation {
    __beforeParentCreate(): void;
}

interface SynchronizesRelatedModels extends Relation {
    __synchronizeRelated(other: Relation): void;
}

export function hasBeforeParentCreateHook(relation: Relation): relation is BeforeParentCreateRelation {
    return '__beforeParentCreate' in relation;
}

export function isSolidDocumentRelation(
    relation: Relation,
): relation is SolidDocumentRelationInstance {
    return 'useSameDocument' in relation;
}

export function isSolidBelongsToRelation(relation: unknown): relation is SolidBelongsToRelation {
    return usesMixin(relation, SolidBelongsToRelation);
}

export function isSolidHasRelation(relation: unknown): relation is SolidHasRelation {
    return usesMixin(relation, SolidHasRelation);
}

export function synchronizesRelatedModels(relation: Relation): relation is SynchronizesRelatedModels {
    return '__synchronizeRelated' in relation;
}