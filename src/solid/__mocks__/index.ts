import RDFDocument from '@/solid/RDFDocument';
import { urlResolve, uuid } from '@noeldemartin/utils';
import type RDFResourceProperty from '@/solid/RDFResourceProperty';

export class SolidClientMock {

    public createDocumentSpy!: jest.SpyInstance<Promise<string>, [string, (string|null)?, (RDFResourceProperty[])?]>;
    public getDocumentSpy!: jest.SpyInstance<Promise<RDFDocument | null>, [string]>;
    public getDocumentsSpy!: jest.SpyInstance<Promise<RDFDocument[]>, [string]>;
    public updateDocumentSpy!: jest.SpyInstance<Promise<void>, [string]>;
    public deleteDocumentSpy!: jest.SpyInstance<Promise<void>, [string]>;
    public documentExistsSpy!: jest.SpyInstance<Promise<boolean>, [string]>;

    private documents: Record<string, RDFDocument[]> = {};

    public reset(): void {
        this.documents = {};
    }

    public async createDocument(
        parentUrl: string,
        url: string | null = null,
        properties: RDFResourceProperty[] = [],
    ): Promise<string> {
        const turtleData = properties
            .map(property => property.toTurtle() + ' .')
            .join('\n');

        if (url === null)
            url = urlResolve(parentUrl, uuid());

        if (await this.documentExists(url))
            throw new Error(`Cannot create a document at ${url}, url already in use`);

        const document = await RDFDocument.fromTurtle(turtleData, { baseIRI: url });

        this.documents[url] = [document];

        return url;
    }

    public async getDocument(url: string): Promise<RDFDocument | null> {
        return this.documents[url]?.[0] ?? null;
    }

    public async getDocuments(containerUrl: string): Promise<RDFDocument[]> {
        const documents: RDFDocument[] = [];

        for (const containerDocuments of Object.values(this.documents)) {
            for (const document of containerDocuments) {
                if (!document.url?.startsWith(containerUrl))
                    continue;

                documents.push(document);
            }
        }

        return documents;
    }

    public async updateDocument(url: string): Promise<void> {
        if (!(url in this.documents))
            throw new Error(
                `Error updating document at ${url}, returned 404 status code`,
            );
    }

    public async deleteDocument(url: string): Promise<void> {
        if (!(url in this.documents))
            return;

        delete this.documents[url];
    }

    public async documentExists(url: string): Promise<boolean> {
        return Object
            .entries(this.documents)
            .some(
                ([documentUrl, urlDocuments]) =>
                    url.startsWith(documentUrl) &&
                    urlDocuments.some(document => document.url === url),
            );
    }

}

const instance = new SolidClientMock();

instance.createDocumentSpy = jest.spyOn(instance, 'createDocument');
instance.getDocumentSpy = jest.spyOn(instance, 'getDocument');
instance.getDocumentsSpy = jest.spyOn(instance, 'getDocuments');
instance.updateDocumentSpy = jest.spyOn(instance, 'updateDocument');
instance.deleteDocumentSpy = jest.spyOn(instance, 'deleteDocument');
instance.documentExistsSpy = jest.spyOn(instance, 'documentExists');

export default instance;
