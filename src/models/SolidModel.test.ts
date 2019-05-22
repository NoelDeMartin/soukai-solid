import Faker from 'faker';

import Soukai, { FieldType } from 'soukai';

import Str from '@/utils/Str';
import Url from '@/utils/Url';

import { stubPersonJsonLD, stubGroupJsonLD } from '@tests/stubs/helpers';
import Group from '@tests/stubs/Group';
import Person from '@tests/stubs/Person';
import StubEngine from '@tests/stubs/StubEngine';

import SolidModel from './SolidModel';

let engine: StubEngine;

describe('SolidModel', () => {

    beforeAll(() => {
        Soukai.loadModel('Group', Group);
        Soukai.loadModel('Person', Person);
    });

    beforeEach(() => {
        engine = new StubEngine();
        Soukai.useEngine(engine);
    });

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
            'http://www.w3.org/ns/ldp#Container',
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

        const containerUrl = Url.resolveDirectory(Faker.internet.url());

        jest.spyOn(engine, 'create');

        Soukai.loadModel('StubModel', StubModel);

        const model = await StubModel.from(containerUrl).create();

        expect(typeof model.url).toEqual('string');
        expect(model.url.startsWith(containerUrl)).toBe(true);

        expect(engine.create).toHaveBeenCalledWith(
            containerUrl,
            expect.anything(),
            model.url,
        );
    });

    it("doesn't mint urls for new models if disabled", async () => {
        class StubModel extends SolidModel {
            static mintsUrls = false;
        }

        const containerUrl = Url.resolveDirectory(Faker.internet.url());

        jest.spyOn(engine, 'create');

        Soukai.loadModel('StubModel', StubModel);

        await StubModel.from(containerUrl).create();

        expect(engine.create).toHaveBeenCalledWith(
            containerUrl,
            expect.anything(),
            undefined,
        );
    });

    it('uses explicit containerUrl for minting url on save', async () => {
        class StubModel extends SolidModel {
        }

        const containerUrl = Url.resolveDirectory(Faker.internet.url());

        jest.spyOn(engine, 'create');

        Soukai.loadModel('StubModel', StubModel);

        const model = new StubModel();

        await model.save(containerUrl);

        expect(typeof model.url).toEqual('string');
        expect(model.url.startsWith(containerUrl)).toBe(true);

        expect(engine.create).toHaveBeenCalledWith(
            containerUrl,
            expect.anything(),
            model.url,
        );
    });

    it('uses explicit containerUrl for minting url on create', async () => {
        class StubModel extends SolidModel {
        }

        const containerUrl = Url.resolveDirectory(Faker.internet.url());

        jest.spyOn(engine, 'create');

        Soukai.loadModel('StubModel', StubModel);

        const model = await StubModel.create({}, containerUrl);

        expect(typeof model.url).toEqual('string');
        expect(model.url.startsWith(containerUrl)).toBe(true);

        expect(engine.create).toHaveBeenCalledWith(
            containerUrl,
            expect.anything(),
            model.url,
        );
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

        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const name = Faker.random.word();

        jest.spyOn(engine, 'create');

        Soukai.loadModel('StubModel', StubModel);

        const model = await StubModel.from(containerUrl).create({ name });

        expect(typeof model.url).toEqual('string');
        expect(model.url).toEqual(Url.resolveDirectory(containerUrl, Str.slug(name)));

        expect(engine.create).toHaveBeenCalledWith(
            containerUrl,
            expect.anything(),
            model.url,
        );
    });

    it('aliases url attribute as id', async () => {
        class StubModel extends SolidModel {
        }

        Soukai.loadModel('StubModel', StubModel);

        const model = new StubModel();

        await model.save();

        expect(model.url).toBeTruthy();
        expect(model.url).toEqual(model.id);
    });

    it('sends JsonLD to engines', async () => {
        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const name = Faker.random.word();

        jest.spyOn(engine, 'create');

        Soukai.loadModel('Person', Person);

        const model = await Person.create({ name }, containerUrl);

        const attributes = (engine.create as any).mock.calls[0][1];

        expect(attributes).toEqual({
            '@id': model.url,
            '@type': [
                { '@id': 'http://cmlns.com/foaf/0.1/Person' },
                { '@id': 'http://www.w3.org/ns/ldp#Resource' },
            ],
            'http://cmlns.com/foaf/0.1/name': name,
        });
    });

    it('implements has many relationship', async () => {
        Soukai.loadModel('Person', Person);

        jest.spyOn(engine, 'readMany');

        engine.setMany('https://example.com/', {
            'https://example.com/alice': stubPersonJsonLD('https://example.com/alice', 'Alice'),
        });

        engine.setMany('https://example.org/', {
            'https://example.org/bob': stubPersonJsonLD('https://example.org/bob', 'Bob'),
        });

        const john = new Person({
            name: 'John',
            knows: [
                'https://example.com/alice',
                'https://example.org/bob',
            ],
        });

        await john.loadRelation('friends');

        expect(john.friends).toHaveLength(2);
        expect(john.friends[0]).toBeInstanceOf(Person);
        expect(john.friends[0].url).toBe('https://example.com/alice');
        expect(john.friends[0].name).toBe('Alice');
        expect(john.friends[1]).toBeInstanceOf(Person);
        expect(john.friends[1].url).toBe('https://example.org/bob');
        expect(john.friends[1].name).toBe('Bob');

        expect(engine.readMany).toHaveBeenCalledTimes(2);
        expect(engine.readMany).toHaveBeenCalledWith(
            'https://example.com/',
            {
                $in: [
                    'https://example.com/alice',
                ],
                '@type': {
                    $contains: [
                        { '@id': 'http://cmlns.com/foaf/0.1/Person' },
                        { '@id': 'http://www.w3.org/ns/ldp#Resource' },
                    ],
                },
            },
        );
        expect(engine.readMany).toHaveBeenCalledWith(
            'https://example.org/',
            {
                $in: [
                    'https://example.org/bob',
                ],
                '@type': {
                    $contains: [
                        { '@id': 'http://cmlns.com/foaf/0.1/Person' },
                        { '@id': 'http://www.w3.org/ns/ldp#Resource' },
                    ],
                },
            },
        );
    });

    it('implements contains relationship', async () => {
        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const musashiUrl = Url.resolve(containerUrl, 'musashi');
        const kojiroUrl = Url.resolve(containerUrl, 'kojiro');

        const group = new Group({
            url: containerUrl,
        });

        jest.spyOn(engine, 'readMany');

        engine.setMany(containerUrl, {
            [musashiUrl]: stubPersonJsonLD(musashiUrl, 'Musashi'),
            [kojiroUrl]: stubPersonJsonLD(kojiroUrl, 'Kojiro'),
        });

        expect(group.members).toBeUndefined();

        await group.loadRelation('members');

        expect(group.members).toHaveLength(2);
        expect(group.members[0]).toBeInstanceOf(Person);
        expect(group.members[0].url).toBe(musashiUrl);
        expect(group.members[0].name).toBe('Musashi');
        expect(group.members[1]).toBeInstanceOf(Person);
        expect(group.members[1].url).toBe(kojiroUrl);
        expect(group.members[1].name).toBe('Kojiro');

        expect(engine.readMany).toHaveBeenCalledTimes(1);
        expect(engine.readMany).toHaveBeenCalledWith(
            containerUrl,
            {
                '@type': {
                    $contains: [
                        { '@id': 'http://cmlns.com/foaf/0.1/Person' },
                        { '@id': 'http://www.w3.org/ns/ldp#Resource' },
                    ],
                },
            },
        );
    });

    it('implements is contained by relationship', async () => {
        const name = Faker.random.word();
        const containerUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(name));
        const person = new Person({
            url: Url.resolve(containerUrl, Faker.random.uuid()),
        });

        jest.spyOn(engine, 'readOne');

        engine.setOne(stubGroupJsonLD(containerUrl, name));

        expect(person.group).toBeUndefined();

        await person.loadRelation('group');

        expect(person.group).toBeInstanceOf(Group);
        expect(person.group.name).toBe(name);

        expect(engine.readOne).toHaveBeenCalledWith(Url.parentDirectory(containerUrl), containerUrl);
    });

});
