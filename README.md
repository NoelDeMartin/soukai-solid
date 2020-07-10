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

Soukai.loadModels({ Person });
Soukai.useEngine(new SolidEngine(SolidAuthClient.fetch.bind(SolidAuthClient)));

// Use your pod url or get it after logging in with solid-auth-client
Person.at('https://example.org').create({ name: 'John Doe' });
```

## Defining Models

All standard [model definition](https://soukai.js.org/guide/defining-models.html) rules apply, with some extra things to keep in mind.

### Primary key

By default, the primary key of a `SolidModel` is called `url` instead of `id`. Like the name suggests, it will be the url of the RDF resource.

### Collections

Most of the time, collections should not be defined in the model class. This is because collections in `SolidEngine` are interpreted as the Solid container url, and that's not something that can be hard-coded. If you're using a different engine, feel free to define collection names, but the default names generated from the model name should suffice.

Given that collections shouldn't be hard-coded, they need to be specified at runtime. There are a couple of helper methods in the `SolidModel` class to make this easier. You can use both `from` and `at`, which are only syntactic sugar to set the static `collection` property of a model:

```js
const containerUrl = 'https://example.org/people/';

// Get persons from the container
const persons = await Person.from(containerUrl).all();

// Create a new person in the container
const person = await Person.at(containerUrl).create({ name: 'Amy Doe' });
```

The `find`, `delete` and `save` methods infer the container url from the model url, so calling these methods is not necessary. With the exception of `save` for new models, which accepts the container url as a first argument (it can be ignored if the model url has been minted before calling `mintUrl` or setting the `url` attribute):

```js
const person = new Person({ name: 'Amy Doe' });

// You can either to this...
await person.save('https://example.org/people/');

// this...
person.mintUrl('https://example.org/people/');

await person.save();

// or this
person.url = 'https://example.org/people/amy';

await person.save();
```

### RDF definitions

When working with Solid entities, there are a couple of things that have to be defined for a model to be serialized as a resource.

One is the types or RDFS classes of the resource (represented in RDF as the `http://www.w3.org/1999/02/22-rdf-syntax-ns#type` property). This can be defined with the `rdfsClasses` static property.

Something else to define is the RDF name for attributes. Those can be defined using the `rdfProperty` key within the field definition.

Here's an example illustrating both:

```js
class Person extends SolidModel {

    static rdfsClasses = ['http://xmlns.com/foaf/0.1/Person'];

    static fields = {
        name: {
            type: FieldType.String,
            rdfProperty: 'http://xmlns.com/foaf/0.1/name',
        },
    };

}
```

Doing this can become tedious, given that the same namespaces will probably be used more than once. In order to help with that, prefixes can be defined using the `rdfContexts` static property.

Here's a definition that's equivalent to the previous snippet:

```js
class Person extends SolidModel {

    static rdfContexts = {
        'foaf': 'http://xmlns.com/foaf/0.1/',
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

- `rdfContexts` has these prefixes included out of the box. These will be merged, not overridden, with the contexts defined in a model class:

  | Prefix | Url |
  |--------|-----------------------------------------------|
  | solid  | `http://www.w3.org/ns/solid/terms#`           |
  | rdfs   | `http://www.w3.org/2000/01/rdf-schema#`       |
  | rdf    | `http://www.w3.org/1999/02/22-rdf-syntax-ns#` |
  | ldp    | `http://www.w3.org/ns/ldp#`                   |
  | purl   | `http://purl.org/dc/terms/`                   |

- `rdfsClasses` is an empty array by default, but this should rarely be left empty for proper RDF modeling. If the context is not defined and the value is not a url, the default prefix context be used (the first one defined in `rdfContexts`).

- `rdfProperty` within field definitions will default to using the default context (the first one defined in `rdfContexts`) plus the field name.

The `Person` class be defined before can be defined more concisely like this:

```js
class Person extends SolidModel {

    static rdfContexts = {
        'foaf': 'http://xmlns.com/foaf/0.1/',
    };

    static rdfsClasses = ['Person'];

    static fields = {
        name: FieldType.String,
    };

}
```
There is also a `SolidContainerModel` class intended to declare container resources. In addition to everything from a `SolidModel`, it comes has the following:

- The `rdfsClass` array contains the `ldp:Container` type and it'll be merged with definitions in the model.
- The field `resourceUrls` is defined as an array equivalent to `ldp:contains` in RDF.
- The relationship `documents` is defined as a belongsToMany relation with `SolidDocument` models, using the `resourceUrls` property as the foreign key. It also provides a special `contains` multi-model relationship (read more about relationships [below](#relations)).
- Minted urls will use the `name` field if it exists to generate a slug instead of a UUID (read more about url minting [below](#url-minting)).

### Url minting

The default behaviour when creating new models is that the url will be minted in the client side, using the container url and generating a UUID. If the model is a `SolidContainerModel` and has a `name` attribute, it will be used to create a slug instead.

This is useful in order to perform operations with a new model before the server request has been resolved, but it be disabled by setting the `mintsUrls` property to `false`. You can also do it manually calling the `mintUrl` method or setting the `url` attribute:

```js
class Person extends SolidModel {
    static mintsUrls = false;
}

// You can do this...
const person = new Person({ name: 'Amy Doe' });

person.mintUrl();

await person.save();

// Or you could set the url yourself
const person = new Person({
    url: 'http://example.org/amy',
    name: 'Amy Doe',
});

await person.save();
```

### Solid Models vs Solid Documents

A `SolidModel` is the Active Record representation of an RDF Resource. This means that multiple models can be stored in the same document.

This is always infered from the `url` attribute, and there is a couple of helper methods such as `isDocumentRoot` and `getDocumentUrl`. When a model is a document root, it means its url matches the url of the document where it is stored.

All of this will be transparent when using the library. But it is useful to be aware of this distinction. Internally, `SolidModel` is serialized to a JSON-LD graph and different models can modify the same EngineDocument. To improve network performance, this can be taken advantage of using relations as documented below.

**Note:** At the moment, models that are not referenced by url won't be found by this library. For example, a model defined at `https://example.org/alice#it` won't be found using a model's `find` method. But it should work being resolved from relations. This is not a limitation of the design of the library, but it hasn't been implemented yet.

### Relations

In addition to the [relations included with the core library](https://soukai.js.org/guide/defining-models.html#relationships), other relations are provided in this package and some are extended with more functionality.

#### hasMany

This relation comes with some helper methods.

`create` and `save` can be used to create and save related models. This is useful to set foreign keys automatically and work with models that are not stored in the document root. Models that are stored in the document of a related model will be saved automatically when the parent model is created if it didn't exist. This can also be set up calling the `addModelToStoreInSameDocument` method.

For example, let's say that we choose to use the `schema:MusicGroup` type to model a music band, and we want to store the members of the band in the same document.

Here's how you could define de models:

```js
class Band extends SolidModel {

    static rdfContexts = {
        'schema': 'https://schema.org/',
    };

    static rdfsClasses = ['MusicGroup'];

    static fields = {
        name: FieldType.String,
    };

    membersRelationship() {
        return this.hasMany(Person, 'bandUrl');
    }

}
```

```js
class Person extends SolidModel {

    static rdfContexts = {
        'schema': 'https://schema.org/',
    };

    static rdfsClasses = ['Person'];

    static fields = {
        name: FieldType.String,
        bandUrl: {
            type: FieldType.Key,
            rdfProperty: 'schema:memberOf',
        },
    };

}
```

And here's an example of creating related models manually:

```js
const acdc = await Band.find('https://example.org/bands/ac-dc');
const angusYoung = Person.create({
    name: 'Angus Young',
    bandUrl: acdc.url,
});
const bonScott = Person.create({
    name: 'Bon Scott',
    bandUrl: acdc.url,
});

// If you pass a url to the mintUrl method, it'll be used as the document to store the resource at
angusYoung.mintUrl(acdc.url);
bonScott.mintUrl(acdc.url);

await Promise.all([
    angusYoung.save(),
    bonScott.save(),
]);

// You can also use the relationship to save the model (this can be useful if you want to save multiple models at once)
acdc.relatedMembers.addModelToStoreInSameDocument(angusYoung);
acdc.relatedMembers.addModelToStoreInSameDocument(bonScott);

await acdc.save();
```

Or you can use helper methods to achieve the same results:

```js
await acdc.relatedMembers.create({ name: 'Angus Young' }, true);
await acdc.relatedMembers.create({ name: 'Bon Scott' }, true);
```

**Note:** Given the nature of Solid, related models defined with `hasMany` will only be loaded if they can be found in the same document as the parent model (the one who defines the relationship). This also works if the foreign key is the only attribute found in the document.

#### contains and isContainedBy

There is a couple of relationships that are helpful to work with Solid containers: `contains` and `isContainedBy`.

Here's an example:

```js
class MoviesContainer extends SolidModel {

    static fields = {
        name: {
            type: FieldType.String,
            rdfProperty: 'rdfs:label',
        },
    };

    moviesRelationship() {
        return this.contains(Movie);
    }

}
```

```js
class Movie extends SolidModel {

    static rdfContexts = {
        'schema': 'https://schema.org/',
    };

    static rdfsClasses = ['Movie'];

    static fields = {
        title: {
            type: FieldType.String,
            rdfProperty: 'schema:name',
        },
    };

    moviesContainerRelationship() {
        return this.isContainedBy(MoviesContainer);
    }

}
```

These methods don't take foreign and local keys because they rely on the `url` of the models to resolve collections and model ids.

## Going Further

If you want to learn more about this library, look at the files ending with `.test.ts` throughout the source code to see other examples.

The code is written using TypeScript, so looking at the source should provide more insights.
