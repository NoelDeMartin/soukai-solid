import { SolidModel } from './SolidModel';

export default class SolidTypeIndex extends SolidModel {

    public static rdfContexts = {
        solid: 'http://www.w3.org/ns/solid/terms#',
    };

    public static rdfsClasses = ['solid:TypeIndex'];

    public static timestamps = false;

}
