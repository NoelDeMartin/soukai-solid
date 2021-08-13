import RDFDocument from '@/solid/RDFDocument';
import type { JsonLD, JsonLDGraph } from '@noeldemartin/solid-utils';

export default async function flattenJsonLD(json: JsonLD): Promise<JsonLDGraph> {
    const document = await RDFDocument.fromJsonLD(json);

    return document.toJsonLD();
}
