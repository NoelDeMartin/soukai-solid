import '';

declare global {

    namespace jest {

        interface Matchers<R> {
            toEqualJsonLD(jsonld: object): R;
            toEqualSPARQL(sparql: string): R;
        }

    }

}
