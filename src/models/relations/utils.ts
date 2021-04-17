import { BelongsToManyRelation, BelongsToOneRelation } from 'soukai';
import type { SolidModel } from '@/models/SolidModel';
import type { Relation } from 'soukai';

export function initializeInverseRelations(relation: Relation, model: SolidModel): void {
    const parentClass = relation.parent.constructor;

    for (const relationName of relation.relatedClass.relations) {
        const relationInstance = model.requireRelation(relationName);

        if (relationInstance.relatedClass !== parentClass)
            continue;

        if (relationInstance instanceof BelongsToManyRelation) {
            model.setAttribute(relationInstance.foreignKeyName, [relation.parent.url]);
            relationInstance.related = [relation.parent];

            continue;
        }

        if (relationInstance instanceof BelongsToOneRelation) {
            model.setAttribute(relationInstance.foreignKeyName, relation.parent.url);
            relationInstance.related = relation.parent;

            continue;
        }
    }
}
