# Writing AutoEncoder classes

## What is AutoEncoder?

AutoEncoder is a base class that makes objects easily encodable, decodable and patchable by using TypeScript decorators.

AutoEncoder uses the `@field` TypeScript decorator to mark all properties that should be encoded, and how they should be encoded. You pass a Decoder class for each property.

Here is an example:

```typescript
import { Encodeable, StringDecoder, NumberDecoder, field } from "@simonbackx/simple-encoding";

class MyClass extends AutoEncoder {
    @field({ decoder: NumberDecoder })
    id: number;

    @field({ decoder: StringDecoder })
    name: string;

    @field({ decoder: MyClass, nullable: true })
    other: MyClass | null = null;

    writeName() {
        console.log(this.name);
    }
}

```

#### @field options

- **decoder** (required)<br>Defines which Decoder will be used to decode the value.<br>These are the most important Decoders used by the `simple-encoding` package:
    - **StringDecoder**
    - **IntegerDecoder**
    - **BooleanDecoder**
    - **EnumDecoder**: new EnumDecoder(enum)
    - **URLDecoder**
    - **DateDecoder** (stores the time in ms)
    - **ArrayDecoder**: e.g. `new ArrayDecoder(StringDecoder)` for an array of strings
    - **MapDecoder**: e.g. `new MapDecoder(StringDecoder, User)` for a map with string keys and User values.
    - ***NullableDecoder***: e.g. `new NullableDecoder(StringDecoder)` (implements Decoder\<string \| null\>) <br>*— normally you don’t wrap it in an @field: you can set nullable to true instead*
- **version**: The version where this field was introduced.
- **nullable**: This makes sure we allow null values when decoding data.
- **optional**: Optional properties won’t throw an error when a key is missing but will use the default value.
- **field**: Your object has a property name, but you can also specify a different key name for the encoded version of your property. E.g. you want to use accessKey in your code, but stored or over the network, you want to use access_key. This is most often used when we want to minimize data and use shorter key names in data that is repeated a lot (e.g. a seating plan of a webshop).
- **upgrade**: This method is called when data has an older version. The old (decoded) data is passed as an argument. The method should convert the old data to the new data structure. Always use this in combination with version.
- **downgrade**: Same as upgrade, but in reverse.
- **defaultValue**: Alternative for assigning a default value in TypeScript.

## Usage

```typescript
const test = MyClass.create({ id: 123, name: "Hello world" });
const test2 = MyClass.create({ id: 123, name: "Hello world", other: test });

// Simulate a network or file storage by converting to JSON
// You can also convert it to a different storage type
const json = JSON.stringify(test2.encode({ version: 1 }));

// ... Store or send the JSON somewhere

// Decode from JSON
const plainObject = JSON.parse(json);
const data = new ObjectData(plainObject, { version: 1 });
const instance = MyClass.decode(data);
// Decode throws if fields are missing or types are not okay.
// You can use the errors to provide good errors in you API's that help developers to
// point out the missing fields or types.

// Now all methods are available again
instance.writeName();
```

---

## Advanced

### 1. Versioning

Now, say we want to change the type of id to a string and we want to have an extra field called createdAt. We can use versioning for this.

[Versioning data](versioning.md)

#### Real example with upgrade

```typescript
export class User extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder, nullable: true, version: 245 })
    organizationId: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 281 })
    memberId: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 14 })
    firstName: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 14 })
    lastName: string | null = null;

    @field({ decoder: EmailDecoder })
    email: string;

    @field({ decoder: Permissions, nullable: true, version: 2, upgrade: () => null })
    @field({
        decoder: UserPermissions,
        nullable: true,
        version: 247,
        upgrade: function (this: User, oldValue: Permissions | null): UserPermissions | null {
            if (!oldValue || !this.organizationId) {
                return null;
            }
            const m = new Map<string, Permissions>();
            m.set(this.organizationId, oldValue);

            return UserPermissions.create({
                globalPermissions: null,
                organizationPermissions: m,
            });
        },
    })
    permissions: UserPermissions | null = null;

    /**
     * Readonly
     */
    @field({ decoder: UserMeta, nullable: true, version: 191 })
    meta: UserMeta | null = null;

    @field({ decoder: BooleanDecoder, version: 81 })
    verified = false;

    /**
     * Readonly
     */
    @field({ decoder: BooleanDecoder, version: 162 })
    hasAccount = false;

    /**
     * Readonly
     */
    @field({ decoder: BooleanDecoder, version: 360 })
    hasPassword = false;

    get name() {
        if (!this.lastName) {
            if (!this.firstName) {
                return '';
            }
            return this.firstName;
        }
        return this.firstName + ' ' + this.lastName;
    }
}
```

### 2. TypeScript

Sometimes, TypeScript can’t properly infer the right type when you use AutoEncoders. In these cases you’ll have to manually add `as Decoder<T>` :

```typescript
// 🚫 Doesn't work
// response.data is of type AutoEncoder
const response = server.request({
		method: "GET",
		url: "/dogs/123",
		decoder: Dog
});


// ✅ Does work
// response.data is of type Dog
const response = server.request({
		method: "GET",
		url: "/dogs/123",
		decoder: Dog as Decoder<Dog>
});


// ✅ Does work
// response.data is of type Dog[]
const response = server.request({
		method: "GET",
		url: "/dogs",
		decoder: new ArrayDecoder(Dog as Decoder<Dog>)
});
```

---

## Do and don’ts

#### 1. Avoid using `optional: true` for optional properties, use nullable instead

Creating optional properties makes it harder to patch objects ([Patching data](patching.md)), because `undefined` means ‘no change’ in a patch. This results in not being able to unset optional properties.

Use optional only for properties that can be missing by some other condition and are not unsettable.

```typescript
// 🚫 Don't
@field({ decoder: StringDecoder, optional: true })
description?: string;


// ✅ Do
@field({ decoder: StringDecoder, nullable: true })
description: string | null = null;
```

#### 2. Do set default values in your structures

Adding default values in your structures, avoid having to have very long ‘create’ calls.

```typescript
// 🚫 Don't
@field({ decoder: StringDecoder })
name: string;

const dog = Dog.create({ name: "" });


// ✅ Do
@field({ decoder: StringDecoder })
name = "";

const dog = Dog.create({});
```
