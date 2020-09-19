import { SoukaiError } from 'soukai';

export enum DocumentFormat {
    RDF = 'RDF',
};

export class MalformedDocumentError extends SoukaiError {

    public readonly documentUrl: string;
    public readonly documentFormat: DocumentFormat;
    public readonly malformationDetails: string;

    constructor(documentUrl: string, documentFormat: DocumentFormat, malformationDetails: string) {
        super(`Malformed ${documentFormat} document found at ${documentUrl} - ${malformationDetails}`);

        this.documentUrl = documentUrl;
        this.documentFormat = documentFormat;
        this.malformationDetails = malformationDetails;
    }

}
