import { FieldType } from 'soukai';

import { SolidModel } from './SolidModel';

export default class SolidTypeRegistration extends SolidModel {

    public static rdfContexts = {
        solid: 'http://www.w3.org/ns/solid/terms#',
    };

    public static rdfsClasses = ['solid:TypeRegistration'];

    public static timestamps = false;

    public static fields = {
        forClass: {
            type: FieldType.Key,
            required: true,
        },
        instance: FieldType.Key,
        instanceContainer: FieldType.Key,
    };

}
