import Soukai, { FieldType } from 'soukai';

import Person from '@tests/stubs/Person';

it('resolves contexts when booting', () => {
    Soukai.loadModel('Stub', Person);

    expect(Person.rdfsClasses).toEqual([
        'http://cmlns.com/foaf/0.1/Person',
    ]);

    expect(Person.fields).toEqual({
        name: {
            type: FieldType.String,
            required: false,
            rdfProperty: 'http://cmlns.com/foaf/0.1/name',
        },
    });
});
