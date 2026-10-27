# Versioning data

When encoding or decoding data, you must specify a version number. This versioning system allows making changes to the data structure while maintaining compatibility with stored data and older clients.

### AutoEncoder

*AutoEncoder* ([Writing AutoEncoder classes](autoencoder.md)) has an easy way to introduce new fields or make changes to fields using the `@field` decorator.

Let's say you want to change the ID field from a number to a string type, and add a new field called createdAt. Versioning makes this possible:

```typescript
class MyClass extends AutoEncoder {
    @field({ decoder: NumberDecoder })
    @field({ 
		    decoder: StringDecoder, 
		    version: 2, 
		    upgrade: (old: number) => old.toString(), 
		    downgrade: (n: string) => parseInt(n) 
		 })
    id: number;

    @field({ decoder: StringDecoder }) 
    name: string;

    @field({ decoder: MyClass, nullable: true })
    other: MyClass | null = null;

    @field({ decoder: DateDecoder, version: 2, upgrade: () => new Date() })
    createdAt: Date;
}
```

*For other classes you'll have to implement it manually in your encode/decode methods (*[Manually implementing encode and decode](manual-encoding.md)).

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

---

### The current version: `Version` constant

In Stamhoofd, we store the current version in `Version`  (`shared/structures/src/Version.ts`).

**Encoding**

```typescript
import { Version } from "@stamhoofd/structures";

const pablo = Dog.create({ id: "123", name: "Pablo", createdAt: new Date() });
const json = JSON.stringify(pablo.encode({ version: Version }));
// Do something with json (send it over the network, store it...)
```

**Decoding**

```typescript
import { Version } from "@stamhoofd/structures";

const plainObject = JSON.parse(json);
const data = new ObjectData(plainObject, { version: Version });
const pablo = Dog.decode(data);
```

**Increasing the version**

We increase the version only during Stamhoofd releases to avoid conflicts when multiple people make changes simultaneously or switch between branches. For adding new properties to data structures during development, use the `...NextVersion` helper.

> The …NextVersion helper doesn’t support upgrade/downgrade methods yet. So you cannot use it when making changes to existing properties. In that case, manually bump the version, but don’t commit your version change yet until it has been reviewed.

```typescript
export class User extends AutoEncoder {
		...
		
    @field({ decoder: StringDecoder, ...NextVersion })
    myNewProperty = ""
    
    ...
  }
```

After release, it will look like this:

```typescript
export class User extends AutoEncoder {
		...
		
    @field({ decoder: StringDecoder, version: 508 })
    myNewProperty = ""
    
    ...
  }
```

---

### **VersionBox**

`VersionBox` is used to keep track of the version something was stored in. This is a wrapper that saves the version of the encoded data. The version will be used when decoding the content:

**Encoding**

```typescript
const pablo = Dog.create({ id: "123", name: "Pablo", createdAt: new Date() });
const json = JSON.stringify(
		new VersionBox(pablo).encode({ version: 508 })
);
```

The `json`  can be stored in a file, in the database or it can be sent to the API. `json` looks like this:

```json
{
		"version": 508,
		"data": {
				"id": "123",
				"name": "Pablo",
				"createdAt": 1749544680676
		}
}
```

**Decoding**

A `VersionBox` can be decoded with the `VersionBoxDecoder`:

```typescript
const plainObject = JSON.parse(json);

// We use version 0 because we don't know which version
const data = new ObjectData(plainObject, { version: 0 }); 

const decoder = new VersionBoxDecoder(Dog as Decoder<Dog>);
const pablo = decoder.decode(data);
```

---

### Deleting fields

You should never delete a field because this will break backwards compatibility. Instead, mark it as deprecated. If the name gets in your way, you can change it without introducing a new version.

In a very far future, we can eventually delete the deprecated fields.

```typescript
class Dog extends AutoEncoder {
		@field({ decoder: StringDecoder })
		id: string;
		
		@field({ decoder: StringDecoder })
		name = ""
		
		@field({ decoder: DateDecoder })
		createdAt = new Date();
}
```

```typescript
class Dog extends AutoEncoder {
		@field({ decoder: StringDecoder })
		id: string;
		
		@field({ decoder: StringDecoder })
		name = ""
		
		/**
		 * @deprecated
		 * Use x instead
		 */
		@field({ decoder: DateDecoder, field: "createdAt" })
		_createdAt = new Date();
}
```
