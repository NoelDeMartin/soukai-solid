import Soukai, { Model } from 'soukai';

import Faker from 'faker';

import Person from '@tests/stubs/Person';
import SolidAuthClient from '@mocks/solid-auth-client';

import SolidEngine from './SolidEngine';

let engine;

beforeAll(() => {
    Soukai.loadModel('Person', Person);

    engine = new SolidEngine();
});

it ('fails when using non-solid models', () => {
    class MyModel extends Model {}

    Soukai.loadModel('MyModel', MyModel);

    const operations = [
        engine.readMany(MyModel as any),
        engine.readOne(MyModel as any, Faker.random.uuid()),
    ];

    for (const operation of operations) {
        expect(operation).rejects.toThrow(Error);
        expect(operation).rejects.toThrow('SolidEngine only supports querying SolidModel models');
    }
});

it('gets many resources', async () => {
    const containerUrl = Faker.internet.url();
    const firstName = Faker.name.firstName();
    const secondName = Faker.name.firstName();

    SolidAuthClient.addFetchResponse(`
        @prefix foaf: <http://cmlns.com/foaf/0.1/> .

        <first>
            a foaf:Person ;
            foaf:name "${firstName}" .

        <second>
            a foaf:Person ;
            foaf:name "${secondName}" .
    `);

    Person.from(containerUrl);

    const documents = await engine.readMany(Person);

    expect(documents).toHaveLength(2);
    expect(documents[0]).toEqual({ id: containerUrl + '/first', name: firstName });
    expect(documents[1]).toEqual({ id: containerUrl + '/second', name: secondName });
});

it('gets one resource by relative id', async () => {
    const containerUrl = Faker.internet.url();
    const id = Faker.random.uuid();
    const name = Faker.name.firstName();

    SolidAuthClient.addFetchResponse(`
        @prefix foaf: <http://cmlns.com/foaf/0.1/> .

        <>
            a foaf:Person ;
            foaf:name "${name}" .
    `);

    Person.from(containerUrl);

    const document = await engine.readOne(Person, id);

    expect(document).toEqual({ id: containerUrl + '/' + id, name });
});

it('gets one resource by absolute id ignoring container', async () => {
    const id = Faker.internet.url() + '/' + Faker.random.uuid();
    const name = Faker.name.firstName();

    SolidAuthClient.addFetchResponse(`
        @prefix foaf: <http://cmlns.com/foaf/0.1/> .

        <>
            a foaf:Person ;
            foaf:name "${name}" .
    `);

    const document = await engine.readOne(Person, id);

    expect(document).toEqual({ id, name });
});
