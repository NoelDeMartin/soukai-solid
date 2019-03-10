import Soukai, { FieldType } from 'soukai';

import SolidModel from './SolidModel';

describe('SolidModel', () => {

    it('resolves contexts when booting', () => {
        class StubModel extends SolidModel {

            public static timestamps = false;

            public static rdfContexts = {
                'foaf': 'http://cmlns.com/foaf/0.1/',
            };

            public static rdfsClasses = ['foaf:Person'];

            public static fields = {
                name: {
                    type: FieldType.String,
                    rdfProperty: 'foaf:givenname',
                },
            };

        }

        Soukai.loadModel('StubModel', StubModel);

        expect(StubModel.rdfsClasses).toEqual([
            'http://cmlns.com/foaf/0.1/Person',
        ]);

        expect(StubModel.fields).toEqual({
            name: {
                type: FieldType.String,
                required: false,
                rdfProperty: 'http://cmlns.com/foaf/0.1/givenname',
            },
        });
    });

    it('defaults to first context if rdfProperty is missing', () => {
        class StubModel extends SolidModel {

            public static timestamps = false;

            public static rdfContexts = {
                'foaf': 'http://cmlns.com/foaf/0.1/',
            };

            public static fields = {
                name: FieldType.String,
            };

        }

        Soukai.loadModel('StubModel', StubModel);

        expect(StubModel.fields).toEqual({
            name: {
                type: FieldType.String,
                required: false,
                rdfProperty: 'http://cmlns.com/foaf/0.1/name',
            },
        });
    });

});
