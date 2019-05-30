# Solid Soukai [![Build Status](https://semaphoreci.com/api/v1/noeldemartin/soukai-solid/branches/master/badge.svg)](https://semaphoreci.com/noeldemartin/soukai-solid)

Solid engine for [Soukai ODM](https://soukai.js.org).

## Getting Started

In order to get familiar with this library, please make sure to read the [Soukai documentation](https://soukai.js.org/guide/) first.

This package provides two extensions to the core Soukai library, a Solid engine and a Solid model.

In order to initialize the engine, you need to provide a method to execute network requests. This method will be used to communicate with the Solid pod. [solid-auth-client](https://github.com/solid/solid-auth-client) is a common choice for building Solid apps because it handles authentication with the server.

To get started, make sure that you have `soukai`, `soukai-solid` and optionally `solid-auth-client` installed:

```js
import { SolidEngine, SolidModel } from 'soukai-solid';
import SolidAuthClient from 'solid-auth-client';
import Soukai from 'soukai';

class Person extends SolidModel {}

Soukai.loadModel("Person", Person);
Soukai.useEngine(new SolidEngine(SolidAuthClient.fetch.bind(SolidAuthClient)));

// Use your pod url or get it after login with solid-auth-client
Person.at('https://example.org').create({ name: 'John Doe' });
```

## Defining Models

All standard [model definition](https://soukai.js.org/guide/defining-models.html) rules apply, with some extra things to keep in mind.

### Collections

Most of the time, collections should not be defined in the model class. This is because collections will serve as the container url where a Solid resource is stored. This is usually obtained at runtime, and it can even be different for multiple instances of the same model class (if they are stored in different containers). In order to make this easier, the `SolidModel` class has a couple of static method to override the collection at runtime: `from` and `at`.

```js
Person.from('https://example.org/my-container').all(persons => {
    console.log('Persons within my-container', persons);
});
```

### RDF-specific definitions

When working with Solid entities, there are a couple of things that have to be defined for a model to be serialized as a resource.

One is the types or RDFS classes of the resource (represented with the `http://www.w3.org/1999/02/22-rdf-syntax-ns#type` property, also rendered as `a` in text/turtle representations). This can be defined with the `rdfsClasses` static property.

Something else to define is the RDF name for attributes. Those can be defined using the `rdfProperty` key within the field definition.

Here's an example illustrating both:

```js
class Person extends SolidModel {

    static rdfsClasses = ['http://cmlns.com/foaf/0.1/Person'];

    static fields = {
        name: {
            type: FieldType.String,
            rdfProperty: 'http://cmlns.com/foaf/0.1/name',
        },
    };

}
```

Doing this can become tedious, given that the same namespaces will probably be used more than once. In order to help with that, prefixes can be defined using the `rdfContexts` static property.

Here's a definition equivalent to the previous code:

```js
class Person extends SolidModel {

    static rdfContexts = {
        'foaf': 'http://cmlns.com/foaf/0.1/',
    };

    static rdfsClasses = ['foaf:Person'];

    static fields = {
        name: {
            type: FieldType.String,
            rdfProperty: 'foaf:name',
        },
    };

}
```

As you may have noticed in the Getting Started example, all those properties are optional. The default values are the following:

- `rdfContexts` has these prefixes included out of the box:

  | Prefix | Url |
  |--------|-----------------------------------------------|
  | solid  | `http://www.w3.org/ns/solid/terms#`           |
  | rdfs   | `http://www.w3.org/2000/01/rdf-schema#`       |
  | rdf    | `http://www.w3.org/1999/02/22-rdf-syntax-ns#` |
  | ldp    | `http://www.w3.org/ns/ldp#`                   |

  Those prefixes will always be available for definitions, so you should abstain from adding them to `rdfContexts` in your models.

- `rdfsClasses` will include the `ldp:Resource` type, and also `ldp:Container` if the `ldpContainer` static property is set to `true`.

- `rdfProperty` within field definitions will default to using the default prefix (the first one on your `rdfContexts` definition) plus the field name.

For example, this code would generate the following definitions:

```js
class Group extends SolidModel {

    static ldpContainer = true;

    static rdfContexts = {
        'foaf': 'http://cmlns.com/foaf/0.1/',
    };

    static rdfsClasses = ['foaf:Group'];

    static fields = {
        name: FieldType.String,
    };

}
```

RDF classes:
- `http://www.w3.org/ns/ldp#Resource`
- `http://www.w3.org/ns/ldp#Container`
- `http://cmlns.com/foaf/0.1/Group`

Resource properties:
- `http://cmlns.com/foaf/0.1/name`

### Url minting

The default behaviour when creating new models is that the url will be minted in the client side, by using the container url and generating a UUID. If the model has been declared as a container (using the `ldpContainer` property) and has a name attribute, the name will be used instead to create a slug.

This is useful in order to perform operations with a new model before the server request has been resolved.

The default behaviour can be disabled by setting the `mintsUrls` property to `false`, in which case the responsibility to create a new url will be left to the server:

```js
class Person extends SolidModel {
    static mintsUrls = false;
}
```

### Relations

In addition to the [relations included with the core library](https://soukai.js.org/guide/defining-models.html#relationships), two other relations are provided in this package to declare resource-container relationships.

These can be declared using the `contains` and `isContainedBy` methods:

```js
class Person extends SolidModel {

    groupRelationship() {
        return this.isContainedBy(Group);
    }

}

class Group extends SolidModel {

    static ldpContainer = true;

    membersRelationship() {
        return this.contains(Person);
    }

}
```

## Going Further

If you want to learn more about this library, look at the [tests](tests) folder to see other examples.

The code is written using TypeScript, so looking at the source would also provide more insights.
