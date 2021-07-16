import '';

declare global {

    namespace jest {

        interface Matchers<R> {
            toEqualJsonLD(jsonld: Record<string, unknown>): R;
        }

    }

}
