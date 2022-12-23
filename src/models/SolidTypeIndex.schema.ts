import { defineSolidModelSchema } from '@/models/schema';

export default defineSolidModelSchema({
    rdfContexts: { solid: 'http://www.w3.org/ns/solid/terms#' },
    rdfsClass: 'TypeIndex',
    timestamps: false,
});
