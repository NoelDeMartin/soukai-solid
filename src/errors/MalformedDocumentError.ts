import { SoukaiError } from 'soukai';

export enum DocumentFormat {
    RDF = 'RDF',
};

export class MalformedDocumentError extends SoukaiError {

    constructor(url: string, format: DocumentFormat, message: string) {
        super(`Malformed ${format} document found at ${url} - ${message}`);
    }

}
