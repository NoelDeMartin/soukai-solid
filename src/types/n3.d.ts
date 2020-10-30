import '@types/n3';

declare module 'n3' {

    interface N3Parser {
        _resolveRelativeIRI(iri: string): string;
    }

}
