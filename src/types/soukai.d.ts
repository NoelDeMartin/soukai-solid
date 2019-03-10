import { SoukaiError, Attributes } from 'soukai';

// Types fix until new version of soukai is released
declare module 'soukai' {

    class SoukaiError {
        constructor(...args: any[]);
    }

    class Model {
        constructor(attributes?: Attributes, exists?: boolean);
    }

}