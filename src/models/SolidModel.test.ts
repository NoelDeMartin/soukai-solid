import Faker from 'faker';

import Soukai, { FieldType, SoukaiError } from 'soukai';

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

        expect(StubModel.rdfsClasses).toEqual(new Set([
            'http://cmlns.com/foaf/0.1/Person',
            'http://www.w3.org/ns/ldp#Resource',
        ]));

        expect(StubModel.fields).toEqual({
            name: {
                type: FieldType.String,
                required: false,
                rdfProperty: 'http://cmlns.com/foaf/0.1/givenname',
            },
        });
    });

    it('adds ldp:Resource to models', () => {
        class StubModel extends SolidModel {
        }

        Soukai.loadModel('StubModel', StubModel);

        expect(StubModel.rdfsClasses).toEqual(new Set([
            'http://www.w3.org/ns/ldp#Resource',
        ]));
    });

    it('adds ldp:Container to container models', () => {
        class StubModel extends SolidModel {

            public static container: boolean = true;

        }

        Soukai.loadModel('StubModel', StubModel);

        expect(StubModel.rdfsClasses).toEqual(new Set([
            'http://www.w3.org/ns/ldp#Resource',
            'http://www.w3.org/ns/ldp#BasicContainer',
        ]));
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

    it('mints URI', () => {
        class StubModel extends SolidModel {
        }

        Soukai.loadModel('StubModel', StubModel);

        const containerUrl = Faker.internet.url();
        const model = new StubModel();

        model.mintURI(containerUrl);

        expect(model.id).not.toBeNull();
        expect(model.id.indexOf(containerUrl)).toBe(0);
    });

    it('cannot mint URIs for existing models', () => {
        class StubModel extends SolidModel {
        }

        Soukai.loadModel('StubModel', StubModel);

        const containerUrl = Faker.internet.url();
        const model = new StubModel({}, true);

        const operation = () => model.mintURI(containerUrl);

        expect(operation).toThrow(SoukaiError);
        expect(operation).toThrow('Cannot mint existing model');
    });

});