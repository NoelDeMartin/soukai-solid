import '@types/n3';

declare module 'n3' {

    interface Parser {
        _resolveRelativeIRI(iri: string): string;
    }

}
