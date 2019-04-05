import Faker from 'faker';

import Soukai, { FieldType } from 'soukai';

import Str from '@/utils/Str';
import Url from '@/utils/Url';

import Person from '@tests/stubs/Person';
import StubEngine from '@tests/stubs/StubEngine';

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
            url: {
                type: FieldType.Key,
                required: false,
                rdfProperty: null,
            },
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

            public static ldpContainer = true;

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
            url: {
                type: FieldType.Key,
                required: false,
                rdfProperty: null,
            },
            name: {
                type: FieldType.String,
                required: false,
                rdfProperty: 'http://cmlns.com/foaf/0.1/name',
            },
        });
    });

    it('mints url for new models', async () => {
        class StubModel extends SolidModel {
        }

        const containerUrl = Faker.internet.url();
        const engine = new StubEngine();

        jest.spyOn(engine, 'create');

        Soukai.loadModel('StubModel', StubModel);
        Soukai.useEngine(engine);

        await StubModel.from(containerUrl).create();

        expect(engine.create).toHaveBeenCalledWith(
            StubModel,

            // TODO test argument using argument matcher
            expect.anything(),
        );

        const attributes = (engine.create as any).mock.calls[0][1];

        expect(attributes).toHaveProperty('url');
        expect((attributes.url as string).startsWith(containerUrl)).toBe(true);
    });

    it('uses explicit containerUrl for minting url on save', async () => {
        class StubModel extends SolidModel {
        }

        const containerUrl = Faker.internet.url();
        const engine = new StubEngine();

        jest.spyOn(engine, 'create');

        Soukai.loadModel('StubModel', StubModel);
        Soukai.useEngine(engine);

        const model = new StubModel();

        await model.save(containerUrl);

        expect(engine.create).toHaveBeenCalledWith(
            StubModel,

            // TODO test argument using argument matcher
            expect.anything(),
        );

        const attributes = (engine.create as any).mock.calls[0][1];

        expect(attributes).toHaveProperty('url');
        expect((attributes.url as string).startsWith(containerUrl)).toBe(true);
    });

    it('uses explicit containerUrl for minting url on create', async () => {
        class StubModel extends SolidModel {
        }

        const containerUrl = Faker.internet.url();
        const engine = new StubEngine();

        jest.spyOn(engine, 'create');

        Soukai.loadModel('StubModel', StubModel);
        Soukai.useEngine(engine);

        await StubModel.create({}, containerUrl);

        expect(engine.create).toHaveBeenCalledWith(
            StubModel,

            // TODO test argument using argument matcher
            expect.anything(),
        );

        const attributes = (engine.create as any).mock.calls[0][1];

        expect(attributes).toHaveProperty('url');
        expect((attributes.url as string).startsWith(containerUrl)).toBe(true);
    });

    it('uses name for minting url for new containers', async () => {
        class StubModel extends SolidModel {
            public static ldpContainer = true;

            public static rdfContexts = {
                'foaf': 'http://cmlns.com/foaf/0.1/',
            };

            public static fields = {
                name: FieldType.String,
            };
        }

        const containerUrl = Faker.internet.url();
        const name = Faker.random.word();
        const engine = new StubEngine();

        jest.spyOn(engine, 'create');

        Soukai.loadModel('StubModel', StubModel);
        Soukai.useEngine(engine);

        await StubModel.from(containerUrl).create({ name });

        expect(engine.create).toHaveBeenCalledWith(
            StubModel,

            // TODO test argument using argument matcher
            expect.anything(),
        );

        const attributes = (engine.create as any).mock.calls[0][1];

        expect(attributes).toHaveProperty('url');
        expect(attributes.url).toEqual(Url.resolve(containerUrl, Str.slug(name)));
    });

    it('aliases url attribute as id', async () => {
        class StubModel extends SolidModel {
        }

        Soukai.loadModel('StubModel', StubModel);
        Soukai.useEngine(new StubEngine());

        const model = new StubModel();

        await model.save();

        expect(model.url).toBeTruthy();
        expect(model.url).toEqual(model.id);
    });

    it('implements has many relationship', async () => {
        Soukai.loadModel('Person', Person);

        const engine = new StubEngine();

        jest.spyOn(engine, 'readMany');

        Soukai.useEngine(engine);

        engine.setMany([
            { url: 'https://example.org/alice', name: 'Alice' },
            { url: 'https://example.org/bob', name: 'Bob' },
        ]);

        const john = new Person({
            name: 'John',
            knows: [
                'https://example.org/alice',
                'https://example.org/bob',
            ],
        });

        await john.loadRelation('friends');

        expect(john.friends).toHaveLength(2);
        expect(john.friends[0]).toBeInstanceOf(Person);
        expect(john.friends[0].url).toBe('https://example.org/alice');
        expect(john.friends[0].name).toBe('Alice');
        expect(john.friends[1]).toBeInstanceOf(Person);
        expect(john.friends[1].url).toBe('https://example.org/bob');
        expect(john.friends[1].name).toBe('Bob');

        expect(engine.readMany).toHaveBeenCalledTimes(1);
        expect(engine.readMany).toHaveBeenCalledWith(
            Person,
            {
                $in: [
                    'https://example.org/alice',
                    'https://example.org/bob',
                ],
            },
        );
    });

});