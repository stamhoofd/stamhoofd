# Encoding & decoding (structures)

## What are Structures?

Structures are data objects that can be encoded (converted to plain objects) and decoded (converted back to class instances). They are essential for:
- Storing JSON data in databases
- Sending data across networks (API)
- Storing data in the browser for caching and offline access
- Versioning: allowing data structure changes without breaking old clients
- Ensuring type safety when receiving data from the API or storage.

In Stamhoofd all structures are currently stored in the `shared/structures` folder. They are used by the backend and frontend. This facilitates seamless communication over the network and ensures secure data storage in both the database and browser.

The encoding and decoding behavior is mostly implemented in the `@simonbackx/simple-encoding` package.

---

## Usage

### Creating structures

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

[Writing AutoEncoder classes](https://github.com/SimonBackx/simple-encoding/blob/master/docs/autoencoder.md)

*An alternative is manually implementing the encode and decode methods (more difficult + doesn’t provide patching behaviour out of the box):* [Manually implementing encode and decode](manual-encoding.md)

### Encoding and decoding data

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

### Patching Data

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

[Patching data](https://github.com/SimonBackx/simple-encoding/blob/master/docs/patching.md)

### Versioning

When encoding or decoding data, you must specify a version number. This versioning system allows making changes to the data structure while maintaining compatibility with stored data and older clients.

[Versioning data](versioning.md)

### Using encodable objects

Often we support encoding/decoding out of the box. Rarely you’ll need to manually encode or decode an object.

[Sending (authenticated) requests in the frontend](../frontend/requests.md)

[Storing data locally in the browser/app](../frontend/local-storage.md)

[Storing data in the database](../backend/database.md)

[Writing endpoints](../backend/endpoints.md)
