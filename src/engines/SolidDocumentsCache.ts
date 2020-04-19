import Arr from '@/utils/Arr';

import { SolidDocument } from './SolidEngine';

type LDPContains = { '@id': string } | { '@id': string }[];

const PREFIX = 'documents-cache-';
const MODIFIED_AT_SUFFIX = '-modified-at';

export default class SolidDocumentsCache {

    private synchronizedDocumentIds: Set<string> = new Set();

    public add(document: SolidDocument): void {
        const id = document['@id'];

        localStorage.setItem(PREFIX + id, JSON.stringify(document));

        this.synchronizedDocumentIds.add(id);
        this.synchronizeEmbeddedDocuments(document);
    }

    public get(id: string): SolidDocument | null {
        if (!this.synchronizedDocumentIds.has(id))
            return null;

        const json = localStorage.getItem(PREFIX + id);

        return json !== null ? JSON.parse(json) : null;
    }

    public forget(id: string): void {
        this.synchronizedDocumentIds.delete(id);
        localStorage.removeItem(PREFIX + id);
        localStorage.removeItem(PREFIX + id + MODIFIED_AT_SUFFIX);
    }

    public clear(): void {
        const keys = Object.keys(localStorage);

        for (const key of keys) {
            if (!key.startsWith(PREFIX))
                continue;

            localStorage.removeItem(key);
        }
    }

    private synchronizeEmbeddedDocuments(document: SolidDocument): void {
        const ldpContains = document['http://www.w3.org/ns/ldp#contains'] as LDPContains;
        const documentTypes = Array.isArray(document['@type'])
            ? document['@type'].map(type => type['@id'])
            : [document['@type']['@id']];

        if (!Arr.contains(documentTypes, 'http://www.w3.org/ns/ldp#Container') || !ldpContains)
            return;

        const resourceIds = Array.isArray(ldpContains)
            ? ldpContains.map(type => type['@id'])
            : [ldpContains['@id']];

        for (const resourceId of resourceIds) {
            const embeddedDocument = document.__embedded[resourceId];

            if (!embeddedDocument)
                continue;

            const modifiedAt = embeddedDocument['http://purl.org/dc/terms/modified'] as string;

            this.synchronizeDocument(resourceId, modifiedAt);
        }
    }

    private synchronizeDocument(id: string, modifiedAt: string): void {
        const previousModifiedAt = localStorage.getItem(PREFIX + id + MODIFIED_AT_SUFFIX);

        if (previousModifiedAt !== null && previousModifiedAt !== modifiedAt)
            this.forget(id);

        localStorage.setItem(PREFIX + id + MODIFIED_AT_SUFFIX, modifiedAt);

        this.synchronizedDocumentIds.add(id);
    }

}
