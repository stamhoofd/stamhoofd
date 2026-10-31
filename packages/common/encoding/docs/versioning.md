# Versioning data

When encoding or decoding data, you must specify a version number. This versioning system allows making changes to the data structure while maintaining compatibility with stored data and older clients.

### AutoEncoder

_AutoEncoder_ ([Writing AutoEncoder classes](autoencoder.md)) has an easy way to introduce new fields or make changes to fields using the `@field` decorator.

Let's say you want to change the ID field from a number to a string type, and add a new field called createdAt. Versioning makes this possible:

```typescript
class MyClass extends AutoEncoder {
    @field({ decoder: NumberDecoder })
    @field({
        decoder: StringDecoder,
        version: 2,
        upgrade: (old: number) => old.toString(),
        downgrade: (n: string) => parseInt(n),
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

_For other classes you'll have to implement it manually in your encode/decode methods (_[Manually implementing encode and decode](manual-encoding.md)).

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

In Stamhoofd, we store the current version in `Version` (`shared/structures/src/Version.ts`).

**Encoding**

```typescript
import { Version } from '@stamhoofd/structures';

const pablo = Dog.create({ id: '123', name: 'Pablo', createdAt: new Date() });
const json = JSON.stringify(pablo.encode({ version: Version }));
// Do something with json (send it over the network, store it...)
```

**Decoding**

```typescript
import { Version } from '@stamhoofd/structures';

const plainObject = JSON.parse(json);
const data = new ObjectData(plainObject, { version: Version });
const pablo = Dog.decode(data);
```

**Increasing the version**

The version is only increased during a Stamhoofd release, to avoid conflicts when multiple people make changes at the same time or switch between branches. Never edit `shared/structures/src/Version.ts` yourself and never commit an explicit `version: N` for an unreleased change: use the `...NextVersion` helper instead, both for new fields and for type changes of existing fields with `upgrade` / `downgrade` hooks.

`Version.ts` exports two numbers:

- `ReleasedVersion`: the version of the latest release. Only the release command (`stam release bump-structures`) changes it.
- `Version`: the version the code runs at. In `development` and `test` (`STAMHOOFD.environment`) this is `ReleasedVersion + 1`, so `...NextVersion` fields are active and their hooks run. In `production` and `staging` it equals `ReleasedVersion`, where those fields are still omitted, exactly like after the release.

```typescript
export class User extends AutoEncoder {
    ...

    @field({ decoder: StringDecoder, ...NextVersion })
    myNewProperty = ""

    @field({ decoder: StringDecoder })
    @field({ ...TranslatedString.field({}), ...NextVersion })
    name = new TranslatedString()

    @field({ decoder: StringDecoder })
    @field(TranslatedString.field({ ...NextVersion }))
    description = new TranslatedString()

    ...
}
```

On release, `stam release bump-structures` replaces every `...NextVersion` inside a `@field(...)` decorator by `version: ReleasedVersion + 1` and bumps `ReleasedVersion`. Spreading `...NextVersion` into the options object of a helper call (such as `TranslatedString.field({ ...NextVersion })`) is supported; `...NextVersion` is only recognised inside a `@field(` decorator (comments and string literals are ignored), and test files (`*.test.ts`, `*.spec.ts`) are skipped so they keep testing the unreleased version. Run `pnpm stam release bump-structures --dry-run` to see which files would change.

After release, the example above looks like this:

```typescript
export class User extends AutoEncoder {
    ...

    @field({ decoder: StringDecoder, version: 508 })
    myNewProperty = ""

    ...
}
```

> **Development database**: the development API encodes at `ReleasedVersion + 1`. Rows that were written locally before you pulled a type-changing `...NextVersion` field were stored at that same version, so decoding them does not run the `upgrade` hook. Reset or reseed the development database when decoding errors appear.

---

### **VersionBox**

`VersionBox` is used to keep track of the version something was stored in. This is a wrapper that saves the version of the encoded data. The version will be used when decoding the content:

**Encoding**

```typescript
const pablo = Dog.create({ id: '123', name: 'Pablo', createdAt: new Date() });
const json = JSON.stringify(new VersionBox(pablo).encode({ version: 508 }));
```

The `json` can be stored in a file, in the database or it can be sent to the API. `json` looks like this:

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
    name = '';

    @field({ decoder: DateDecoder })
    createdAt = new Date();
}
```

```typescript
class Dog extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: StringDecoder })
    name = '';

    /**
     * @deprecated
     * Use x instead
     */
    @field({ decoder: DateDecoder, field: 'createdAt' })
    _createdAt = new Date();
}
```
