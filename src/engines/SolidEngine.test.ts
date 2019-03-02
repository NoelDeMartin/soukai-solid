import Soukai, { Model } from 'soukai';

import Faker from 'faker';
import SolidEngine from '@/engines/SolidEngine';

import Person from '@tests/stubs/Person';
import SolidAuthClient from '@mocks/solid-auth-client';

beforeAll(() => {
    Soukai.loadModel('Person', Person);
});

it ('fails when using non-solid models', () => {
    class MyModel extends Model {}

    Soukai.loadModel('MyModel', MyModel);

    const engine = new SolidEngine();

    const operation = engine.readMany(MyModel as any);

    expect(operation).rejects.toThrow(Error);
    expect(operation).rejects.toThrow('SolidEngine only supports querying SolidModel models');
});

it('parses attributes', () => {
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

    const engine = new SolidEngine();

    engine.readMany(Person).then(documents => {
        expect(documents).toHaveLength(2);
        expect(documents[0]).toEqual({ id: containerUrl + '/first', name: firstName });
        expect(documents[1]).toEqual({ id: containerUrl + '/second', name: secondName });
    });
});
