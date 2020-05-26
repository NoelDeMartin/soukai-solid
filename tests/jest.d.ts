import { TurtleParsingOptions } from '@/solid/utils/RDF';

declare global {

    namespace jest {

        interface Matchers<R> {
            toEqualJsonLD(jsonld: object): R;
            toEqualTurtle(turtle: string, options?: TurtleParsingOptions): R;
        }

    }

}
