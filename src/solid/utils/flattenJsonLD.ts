import RDFDocument from '@/solid/RDFDocument';
import type { JsonLD, JsonLDGraph } from '@/solid/utils/RDF';

export default async function flattenJsonLD(json: JsonLD): Promise<JsonLDGraph> {
    const document = await RDFDocument.fromJsonLD(json);

    return document.toJsonLD();
}
