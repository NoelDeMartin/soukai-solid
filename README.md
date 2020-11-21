# Solid Soukai [![Build Status](https://semaphoreci.com/api/v1/noeldemartin/soukai-solid/branches/master/badge.svg)](https://semaphoreci.com/noeldemartin/soukai-solid)

Solid engine for [Soukai ODM](https://soukai.js.org).

## Table of contents

- [Getting Started](#getting-started)
- [Solid Models vs Solid Documents](#solid-models-vs-solid-documents)
- [Defining Solid Models](#defining-solid-models)
    - [Primary keys](#primary-keys)
    - [Collections](#collections)
    - [RDF definitions](#rdf-definitions)
    - [Url minting](#url-minting)
    - [Relations](#relations)
- [Going Further](#going-further)

-----

## Getting Started

This library allows you to store and read data from a [Solid POD](https://solidproject.org/) using the Soukai ODM. Before going into Solid specifics, you should be familiar with Soukai basics so make sure to read the [Soukai documentation](https://soukai.js.org/guide/) first.

There are two extensions to the core Soukai library, a Solid engine and a some Solid models (with their respective relationships).

Managing the authentication is outside the scope of this package, so you'll need to provide a fetch method to perform network requests. In this example, we will use [solid-auth-client](https://github.com/solid/solid-auth-client).

To get started, initialize the engine and make sure to call `loadSolidModels` to load models that are provided by this library. Please note that this is just an example to get up and running, but you should define some Solid specific properties in the model for a real application. Make sure to read on after this.

```js
import SoukaiSolid, { SolidEngine, SolidModel } from 'soukai-solid';
import SolidAuthClient from 'solid-auth-client';
import Soukai from 'soukai';

class Person extends SolidModel {}

SoukaiSolid.loadSolidModels();
Soukai.loadModels({ Person });
Soukai.useEngine(new SolidEngine(SolidAuthClient.fetch.bind(SolidAuthClient)));

// You would normally get the Solid POD url from solid-auth-client,
// we're hard-coding it here as an example.
Person.at('https://example.org/people/').create({ name: 'John Doe' });
```

## Solid Models vs Solid Documents

Soukai is a library designed to work with document databases, hence calling it an ODM (Object Document Mapper). This usually means that a Soukai model maps to a database document, and documents are stored within collections in the database.

However, in Solid things work a little different. A Solid container is the equivalent of a collection, but Solid documents don't map directly to Soukai models. Instead, Soukai models represent RDF resources. This is an irrelevant distinction when a Solid document only contains a single RDF resource, but that's rarely the case. Proper RDF modeling often results in documents containing information about multiple resources.

All of this complexity is dealt with under the hood, but it is important to be aware of the distinction. There are also some practical implications that you'll see in the following sections dealing with collections. Internally, `SolidModel` is serialized to a JSON-LD graph and different models can end up modifying the same document.

The way that models are stored in documents can be configured with relations, and there are some methods to get document information. `getDocumentUrl()` returns the document information from the model url, and `getSourceDocumentUrl()` returns information about the document where the RDF resource was read from. Most of the time both should be the same document, but there is nothing in Solid that forbids doing otherwise.

## Defining Solid Models

All standard [model definition](https://soukai.js.org/guide/defining-models.html) rules apply, with some extra things to keep in mind.

### Primary keys

By default, the attribute that serves as the primary key for a `SolidModel` is `url` instead of `id`. As its name suggests, this is the url of the RDF resource that represents the model.

### Collections

The concept of collections in Solid is represented with Solid containers. Given the dynamic nature of Solid, collection names should not be hard-coded in the model class. Instead, they will be inferred from the model url. Since the url of a model is not always available, there are a couple of helper methods in the `SolidModel` class to make this easier.

You can use both `from` and `at`, which are only syntactic sugar to set the static `collection` property of a model at runtime:

```js
// This is something you would obtain at runtime from other models or libraries.
const containerUrl = 'https://example.org/people/';

// Get persons from the container.
const persons = await Person.from(containerUrl).all();

// Create a new person in the container.
const person = await Person.at(containerUrl).create({ name: 'Amy Doe' });
```

The `find`, `delete` and `save` methods infer the container url from the model url, so calling `from` or `at` is not necessary. However, the `save` accepts the container url as a first argument. This can be ignored if the model url has been minted before by calling `mintUrl` or setting the `url` attribute:

```js
const person = new Person({ name: 'Amy Doe' });

// You can either do this...
await person.save('https://example.org/people/');

// or this...
person.mintUrl('https://example.org/people/');

await person.save();

// or this.
person.url = 'https://example.org/people/amy#it';

await person.save();
```

### RDF definitions

When working with Solid entities, there are a couple of things that have to be defined for a model to be serialized properly as an RDF resource.

You can indicate the resource types using the `rdfsClasses` static property (these will be serialized as `http://www.w3.org/1999/02/22-rdf-syntax-ns#type` RDF properties).

Property names can be defined using the `rdfProperty` key within the field definition.

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

Doing this all the time can become cumbersome, given that the same namespaces will probably be used multiple times. You can define reusable prefixes using the `rdfContexts` static property.

Here's a definition equivalent to the previous snippet:

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

As we've seen in the Getting Started example, those properties are optional. Here's their default values:

- `rdfContexts` has the following prefixes included out of the box. If you define your own, these will be merged and not overridden:

  | Prefix | Url |
  |--------|-----------------------------------------------|
  | solid  | `http://www.w3.org/ns/solid/terms#`           |
  | rdfs   | `http://www.w3.org/2000/01/rdf-schema#`       |
  | rdf    | `http://www.w3.org/1999/02/22-rdf-syntax-ns#` |
  | ldp    | `http://www.w3.org/ns/ldp#`                   |
  | purl   | `http://purl.org/dc/terms/`                   |

- `rdfsClasses` is an empty array by default, but this should rarely be left empty for proper RDF modeling. Values that are not urls or short-hand definitions using contexts will use the default context (the first one defined in `rdfContexts`).

- `rdfProperty` within field definitions will use the field name with the default context (the first one defined in `rdfContexts`).

The `Person` class we defined before can be defined more concisely like this:

```js
class Person extends SolidModel {

    static rdfContexts = {
        // This will be the default context, because it is defined first.
        'foaf': 'http://xmlns.com/foaf/0.1/',
    };

    // Because "Person" is not a url or short-hand definition using contexts,
    // the default context will be used. This will be interpreted as "foaf:Person".
    static rdfsClasses = ['Person'];

    static fields = {
        // Because "foaf" is the default context and "name" is the name of the field,
        // the rdfProperty will be interpreted as "foaf:name".
        name: FieldType.String,
    };

}
```

There is also a `SolidContainerModel` class that should be used to declare container models. In addition to everything from a `SolidModel`, it has the following built-in definitions:

- The `rdfsClasses` array contains the `ldp:Container` type, it'll be merged with definitions in the model. So it actually makes sense to leave `rdfsClasses` undefined for container models.
- The `resourceUrls` field is defined as an array mapped from the `ldp:contains` RDF property.
- The relationship `documents` is defined as a belongsToMany relation with `SolidDocument` models, using the `resourceUrls` property as the foreign key. It also provides a special `contains` multi-model relationship (read more about relationships [below](#relations)).
- Minted urls will use the `name` field if it exists to generate a slug instead of a UUID, and they won't use a hash at the end (read more about url minting [below](#url-minting)).

### Url minting

The default behavior when creating new models is that the url will be minted in the client side, using the container url and generating a UUID. It will also add a hash at the end which can be configured defining the `defaultResourceHash` static property in the model (it'll be defined as "it" by default).

If the model is a `SolidContainerModel` and has a `name` attribute, this will be used to create a slug instead. Container models don't use a hash in the url and end with a trailing slash.

Url minting is useful in order to perform operations with a new model before the server request has been resolved, but it can be disabled by setting the `mintsUrls` property to `false`. You can also mint it manually calling the `mintUrl` method or setting the `url` attribute:

```js
class Person extends SolidModel {
    static mintsUrls = false;
}

// You can do this...
const person = new Person({ name: 'Amy Doe' });

person.mintUrl();

await person.save();

// Or you could set the url yourself.
const person = new Person({
    url: 'http://example.org/amy#it',
    name: 'Amy Doe',
});

await person.save();
```

### Relations

In addition to the [relations included with the core library](https://soukai.js.org/guide/defining-models.html#relationships), other relations are provided in this package and some are extended with more functionality.

#### hasMany

This relation comes with some helper methods.

`create`, `save` and `add` can be used to associate models, setting foreign keys. Models that are stored in the same document of a related model will be saved automatically when the parent model  (the one who defines the relationship) is created if it didn't exist. This can be configured using the `usingSameDocument` method.

When related models are stored in the same document, the hash of those models will be a UUID instead of the one defined in their `defaultResourceHash` static property.

For example, let's say that we want to model a Music Band with all their members, and we want to store all the RDF resources in the same document:

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
        return this.hasMany(Person, 'bandUrl').usingSameDocument(true);
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

And here's an example using those models:

```js
const acdc = await Band.find('https://example.org/bands/ac-dc');

// You can create the model yourself, and it'll be stored when the parent is saved.
acdc.relatedMembers.add(new Person({ name: 'Bon Scott' }));

await acdc.save();

// Or you can use the create method.
// Notice how we're not specifying the bandUrl in either scenario.
await acdc.relatedMembers.create({ name: 'Angus Young' });
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

If you want to see more examples, you can find some models defined under [tests/stubs/models](tests/stubs/models) and files ending with `.test.ts` throughout the source code.

If you want to see some real-life applications using this library, check out [Media Kraken](https://github.com/noeldemartin/media-kraken) and [Solid Focus](https://github.com/NoelDeMartin/solid-focus).
