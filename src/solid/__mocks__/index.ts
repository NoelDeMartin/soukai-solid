import RDF from '@/solid/utils/RDF';
import RDFDocument from '@/solid/RDFDocument';
import RDFResourceProperty from '@/solid/RDFResourceProperty';

import Url from '@/utils/Url';
import UUID from '@/utils/UUID';

export class SolidClientMock {

    private documents: MapObject<RDFDocument[]> = {};

    public reset(): void {
        this.documents = {};
    }

    public async createDocument(
        parentUrl: string,
        url: string | null = null,
        properties: RDFResourceProperty[] = [],
    ): Promise<RDFDocument> {
        const turtleData = properties
            .map(property => property.toTurtle() + ' .')
            .join("\n");

        if (url === null)
            url = Url.resolve(parentUrl, UUID.generate());

        if (await this.documentExists(url))
            throw new Error(`Cannot create a document at ${url}, url already in use`);

        const document = await RDF.parseTurtle(turtleData, { baseUrl: url });

        this.documents[url] = [document];

        return document;
    }

    public async getDocument(url: string): Promise<RDFDocument | null> {
        return url in this.documents ? this.documents[url][0] : null;
    }

    public async getDocuments(containerUrl: string, onlyContainer?: boolean): Promise<RDFDocument[]> {
        const documents: RDFDocument[] = [];

        for (const containerDocuments of Object.values(this.documents)) {
            for (const document of containerDocuments) {
                if (!document.url!.startsWith(containerUrl))
                    continue;

                documents.push(document);
            }
        }

        return documents;
    }

    public async updateDocument(
        url: string,
        updatedProperties: RDFResourceProperty[],
        removedProperties: string[],
    ): Promise<void> {
        if (!(url in this.documents))
            throw new Error(
                `Error updating document at ${url}, returned status code 404`,
            );
    }

    public async deleteDocument(url: string): Promise<void> {
        if (!(url in this.documents))
            return;

        delete this.documents[url];
    }

    public async documentExists(url: string): Promise<boolean> {
        return Object.keys(this.documents).some(documentUrl => {
            if (!url.startsWith(documentUrl))
                return false;

            for (const document of this.documents[documentUrl]) {
                if (document.url === url)
                    return true;
            }

            return false;
        });
    }
}

const instance = new SolidClientMock();

jest.spyOn(instance, 'createDocument');
jest.spyOn(instance, 'getDocument');
jest.spyOn(instance, 'getDocuments');
jest.spyOn(instance, 'updateDocument');
jest.spyOn(instance, 'deleteDocument');
jest.spyOn(instance, 'documentExists');

export default instance;
