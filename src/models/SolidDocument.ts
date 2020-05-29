import SolidModel from './SolidModel';

export default class SolidDocument extends SolidModel {

    public static timestamps = ['updatedAt'];

    public static rdfContexts = {
        'iana': 'http://www.w3.org/ns/iana/media-types/text/turtle#',
    };

    public static rdfsClasses = ['Resource'];

}
