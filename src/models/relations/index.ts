import SolidBelongsToManyRelation from './SolidBelongsToManyRelation';
import SolidBelongsToOneRelation from './SolidBelongsToOneRelation';
import SolidContainerDocumentsRelation from './SolidContainerDocumentsRelation';
import SolidContainsRelation from './SolidContainsRelation';
import SolidHasManyRelation from './SolidHasManyRelation';
import SolidHasOneRelation from './SolidHasOneRelation';
import SolidIsContainedByRelation from './SolidIsContainedByRelation';

SolidContainsRelation.inverseRelationClasses = [SolidIsContainedByRelation];
SolidIsContainedByRelation.inverseRelationClasses = [SolidContainsRelation];

export {
    SolidBelongsToManyRelation,
    SolidBelongsToOneRelation,
    SolidContainerDocumentsRelation,
    SolidContainsRelation,
    SolidHasManyRelation,
    SolidHasOneRelation,
    SolidIsContainedByRelation,
};

export type { SolidBelongsToManyRelationBase } from './SolidBelongsToManyRelation';
export type { SolidBelongsToOneRelationBase } from './SolidBelongsToOneRelation';
export type { SolidHasManyRelationBase } from './SolidHasManyRelation';
export type { SolidHasOneRelationBase } from './SolidHasOneRelation';

export type { SolidRelation } from './inference';
export type {
    default as SolidBelongsToRelation,
    ProtectedThis as SolidBelongsToRelationProtectedThis,
    This as SolidBelongsToRelationThis,
} from './mixins/SolidBelongsToRelation';
export type { default as SolidDocumentRelation, ISolidDocumentRelation } from './mixins/SolidDocumentRelation';
export type {
    default as SolidHasRelation,
    ProtectedThis as SolidHasRelationProtectedThis,
    This as SolidHasRelationThis,
} from './mixins/SolidHasRelation';
export type {
    default as SolidMultiModelDocumentRelation,
    This as SolidMultiModelDocumentRelationThis,
} from './mixins/SolidMultiModelDocumentRelation';
export type {
    default as SolidSingleModelDocumentRelation,
    This as SolidSingleModelDocumentRelationThis,
} from './mixins/SolidSingleModelDocumentRelation';
