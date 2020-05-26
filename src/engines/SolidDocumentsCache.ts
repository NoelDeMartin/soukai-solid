import { EngineDocument } from 'soukai';
import { get, set, del, keys } from 'idb-keyval';

import { IRI } from '@/solid/utils/RDF';

import Arr from '@/utils/Arr';

const PREFIX = 'documents-cache-';
const MODIFIED_AT_SUFFIX = '-modified-at';

export default class SolidDocumentsCache {

    private synchronizedDocumentIds: Set<string> = new Set();

    public async add(id: string, document: EngineDocument): Promise<void> {
        this.synchronizedDocumentIds.add(id);

        await set(PREFIX + id, document);
        await this.synchronizeContainerDocuments(document);
    }

    public async get(id: string): Promise<EngineDocument | null> {
        if (!this.synchronizedDocumentIds.has(id))
            return null;

        const json = await get<EngineDocument>(PREFIX + id);

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

    private async synchronizeContainerDocuments(document: EngineDocument): Promise<void> {
        const resources = document['@graph'] as object[];
        const containerResourceReferences = resources
            .filter(resource => IRI('ldp:contains') in resource)
            .map(resource => resource[IRI('ldp:contains')])
            .map(references => Array.isArray(references) ? references : [references]);
        const synchronizationPromises = Arr.flatten(containerResourceReferences)
            .map((reference: object) => reference['@id'])
            .map(url => resources.find(resource => resource['@id'] === url))
            .filter(resource => (
                !!resource &&
                IRI('purl:modified') in resource
            ))
            .map(
                (containerResource: object) =>
                    this.synchronizeContainerDocument(
                        containerResource['@id'],
                        containerResource[IRI('purl:modified')]['@value'],
                    ),
            );

        await Promise.all(synchronizationPromises);
    }

    private async synchronizeContainerDocument(id: string, modifiedAt: string): Promise<void> {
        const previousModifiedAt = await get(PREFIX + id + MODIFIED_AT_SUFFIX);

        if (previousModifiedAt !== null && previousModifiedAt !== modifiedAt)
            await this.forget(id);

        await set(PREFIX + id + MODIFIED_AT_SUFFIX, modifiedAt);

        this.synchronizedDocumentIds.add(id);
    }

}
