import { get, set, del, keys } from 'idb-keyval';

import Arr from '@/utils/Arr';

import { SolidDocument } from './SolidEngine';

type LDPContains = { '@id': string } | { '@id': string }[];

const PREFIX = 'documents-cache-';
const MODIFIED_AT_SUFFIX = '-modified-at';

export default class SolidDocumentsCache {

    private synchronizedDocumentIds: Set<string> = new Set();

    public async add(document: SolidDocument): Promise<void> {
        const id = document['@id'];

        this.synchronizedDocumentIds.add(id);

        await set(PREFIX + id, document);
        await this.synchronizeEmbeddedDocuments(document);
    }

    public async get(id: string): Promise<SolidDocument | null> {
        if (!this.synchronizedDocumentIds.has(id))
            return null;

        const json = await get<SolidDocument>(PREFIX + id);

        return json || null;
    }

    public async forget(id: string): Promise<void> {
        this.synchronizedDocumentIds.delete(id);

        await del(PREFIX + id);
        await del(PREFIX + id + MODIFIED_AT_SUFFIX);
    }

    public async clear(): Promise<void> {
        const dbKeys = await keys();

        await Promise.all(dbKeys.map(async key => {
            if (typeof key !== 'string' || !key.startsWith(PREFIX))
                return;

            await del(key);
        }));
    }

    private async synchronizeEmbeddedDocuments(document: SolidDocument): Promise<void> {
        const ldpContains = document['http://www.w3.org/ns/ldp#contains'] as LDPContains;
        const documentTypes = Array.isArray(document['@type'])
            ? document['@type'].map(type => type['@id'])
            : [document['@type']['@id']];

        if (!Arr.contains(documentTypes, 'http://www.w3.org/ns/ldp#Container') || !ldpContains)
            return;

        const resourceIds = Array.isArray(ldpContains)
            ? ldpContains.map(type => type['@id'])
            : [ldpContains['@id']];

        await Promise.all(resourceIds.map(async resourceId => {
            const embeddedDocument = document.__embedded[resourceId];

            if (!embeddedDocument)
                return;

            const modifiedAt = embeddedDocument['http://purl.org/dc/terms/modified'] as string;

            await this.synchronizeDocument(resourceId, modifiedAt);
        }));
    }

    private async synchronizeDocument(id: string, modifiedAt: string): Promise<void> {
        const previousModifiedAt = await get(PREFIX + id + MODIFIED_AT_SUFFIX);

        if (previousModifiedAt !== null && previousModifiedAt !== modifiedAt)
            await this.forget(id);

        await set(PREFIX + id + MODIFIED_AT_SUFFIX, modifiedAt);

        this.synchronizedDocumentIds.add(id);
    }

}
