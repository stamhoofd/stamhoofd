# Simple encoding

This small library has no dependencies and adds interfaces and classes that you can use to encode and decode your own classes to a JSON compatible structure. This enables you to build powerful API's and storage that can automigrate to newer versions on the fly.

Encoding and decoding can get customized, and that's the whole point of this library. You'll need to write some minor boilerplate code, but that will allow you to customize and work fast. You can also use the decorators and write almost no boilerplate code.

## Installation

### Yarn

```
yarn add @simonbackx/simple-encoding
```

### NPM

```
npm install @simonbackx/simple-encoding
```

## Documentation

## Encoding & decoding (structures)

### What are Structures?

Structures are data objects that can be encoded (converted to plain objects) and decoded (converted back to class instances). They are essential for:
- Storing JSON data in databases
- Sending data across networks (API)
- Storing data in the browser for caching and offline access
- Versioning: allowing data structure changes without breaking old clients
- Ensuring type safety when receiving data from the API or storage.

In Stamhoofd all structures are currently stored in the `shared/structures` folder. They are used by the backend and frontend. This facilitates seamless communication over the network and ensures secure data storage in both the database and browser.

The encoding and decoding behavior is mostly implemented in the `@simonbackx/simple-encoding` package.

---

### Usage

#### Creating structures

The easiest way to create encodable and decodable structures is by extending the AutoEncoder class. Here's a basic example:

```typescript
import { AutoEncoder, StringDecoder, NumberDecoder, field } from "@simonbackx/simple-encoding";

class MyClass extends AutoEncoder {
    @field({ decoder: NumberDecoder })
    id: number;

    @field({ decoder: StringDecoder })
    name: string;

    @field({ decoder: MyClass, nullable: true })
    other: MyClass | null = null;
}
```

[Writing AutoEncoder classes](docs/autoencoder.md)

*An alternative is manually implementing the encode and decode methods (more difficult + doesn’t provide patching behaviour out of the box):* [Manually implementing encode and decode](docs/manual-encoding.md)

#### Encoding and decoding data

You can encode structures so you can store them as JSON in a file, in the database or send it over via the API.

**Encoding**

```typescript
const pablo = Dog.create({ id: 123, name: "Pablo", createdAt: new Date() });

// Simulate a network or file storage by converting to JSON
// You can also convert it to a different storage type
const json = JSON.stringify(pablo.encode({ version: 1 }));
```

You can store `json` this in a file, in the database or send it to the API. `json` looks like this:

```json
{
		"id": 123,
		"name": "Pablo",
		"createdAt": 1749544680676,
}
```

**Decoding**

Decode throws if fields are missing or if types are wrong. This way you are always 100% certain that your decoded data matches your types. The errors thrown contain detailed information for debugging.

```typescript
const plainObject = JSON.parse(json);
const data = new ObjectData(plainObject, { version: 1 });
const pablo = Dog.decode(data);
```

```typescript
const plainObject = {
		id: "test",
		name: "Pablo",
		createdAt: 1749544680676
};
const data = new ObjectData(plainObject, { version: 1 });

const pablo = Dog.decode(data);
// ❌ Throws "Expected an integer at id"
```

#### Patching Data

Patching allows you to modify specific properties of an object without changing the original object. All AutoEncoder classes are patchable by default.

Here's how patching works:

```typescript
// 1. Creating an initial object
const myObject = MyObject.create({ id: 1, name: "Hello world", age: 20 });

// 2. Creating a simple patch
const patch = MyObject.patch({ name: "Changed name" });
// Encoded as ± { name: "Changed name" }

// 3. Applying the patch
const patchedObject = myObject.patch(patch);
// Result: { id: 1, name: "Changed name", age: 20 }
```

[Patching data](docs/patching.md)

#### Versioning

When encoding or decoding data, you must specify a version number. This versioning system allows making changes to the data structure while maintaining compatibility with stored data and older clients.

[Versioning data](docs/versioning.md)

#### Using encodable objects

Often we support encoding/decoding out of the box. Rarely you’ll need to manually encode or decode an object.

[Sending (authenticated) requests in the frontend](https://github.com/SimonBackx/simple-networking/blob/master/docs/requests.md)

[Storing data locally in the browser/app](https://github.com/stamhoofd/stamhoofd/blob/main/contributing/frontend/local-storage.md)

[Storing data in the database](https://github.com/SimonBackx/simple-database/blob/master/docs/models.md)

[Writing endpoints](https://github.com/SimonBackx/simple-endpoints/blob/master/docs/endpoints.md)

## Features

-   Great errors out of the box
-   Customize as you wish:
    -   By not using automatic generation of the encoded format, you can easily let the field names and types differ between the encoded version and your actual instances.
    -   You can add your own decoders/validators for custom fields (e.g. phone number)
-   Minor and readable boilerplate code

## Todo

-   [x] Add context to Data: Allows for versioning (e.g. you can store a verion in the context and let the encoding/decoding differ between each version). In fact you could add this yourself by implementing Data.
-   [ ] Add some more basic types
-   [ ] Full map-patching usage guide
