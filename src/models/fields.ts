import type { BootedFieldsDefinition, FieldsDefinition } from 'soukai';

export type SolidFieldsDefinition = FieldsDefinition<{
    rdfProperty?: string;
}>;
export type SolidBootedFieldsDefinition = BootedFieldsDefinition<{
    rdfProperty?: string;
}>;
