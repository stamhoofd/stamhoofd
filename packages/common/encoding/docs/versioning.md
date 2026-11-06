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
    id: string;

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

### Changing the type of a field

A property can have multiple `@field` decorators. Each one is a separate definition of that property with its own version (`0` when omitted). When encoding or decoding at version `v`, the newest definition with a `version` lower than or equal to `v` is used.

```typescript
class MyClass extends AutoEncoder {
    @field({ decoder: NumberDecoder })
    @field({
        decoder: StringDecoder,
        version: 2,
        upgrade: (old: number) => old.toString(),
        downgrade: (n: string) => parseInt(n),
    })
    id: string;
}
```

So version 0 and 1 store `id` as a number, version 2 and up as a string. In TypeScript the property has the type of the newest definition: that is the only one your code sees.

- Never delete an older definition: it is the only thing that can still read data stored at that version.
- If one definition sets `defaultValue`, all of them need one (`missing_default_value` error).

Helpers such as `TranslatedString.field()` return the options including the hooks:

```typescript
@field({ decoder: StringDecoder })
@field(TranslatedString.field({ version: 2 }))
name = new TranslatedString();
```

### Upgrade and downgrade

`upgrade` and `downgrade` convert a value between a definition and the definition before it. They belong to the newer definition.

`upgrade` runs when decoding older data, after all fields are decoded, from low to high version. Each hook gets the value of the previous definition, so multiple type changes are applied one after the other:

```typescript
@field({ decoder: IntegerDecoder })
@field({ decoder: StringDecoder, version: 2, upgrade: (old: number) => old.toString() })
@field({ decoder: Price, version: 5, upgrade: (old: string) => Price.create({ value: parseInt(old) }) })
price: Price;
```

A new field has no previous definition, so its `upgrade` gets `undefined`:

```typescript
@field({ decoder: DateDecoder, version: 2, upgrade: () => new Date() })
createdAt: Date;
```

Without `upgrade`, a value that is missing in the older data falls back to `defaultValue`, the default in the class definition, `null` if nullable, the default value of the decoder, or `undefined`.

Use a regular function if you need `this` (the object being decoded). Fields that didn't exist in the decoded version are `undefined` while the upgrades run, even if the class definition gives them a default.

`downgrade` runs when encoding for an older version, from high to low version, on a shallow copy of the object. Fields newer than that version are left out of the encoded data, so a field that was only added doesn't need a `downgrade`. Losing information is fine: the result only has to be what the old version understood.

For patches, `upgrade` and `downgrade` are reused, but keep `undefined` (= not changed) as `undefined`. Use `upgradePatch` / `downgradePatch` when the patch of a value looks different than the value itself, like for `TranslatedString`, where a patch only contains the changed translations. Fields with their own patch decoder (an `AutoEncoder`, array or map) only use `upgradePatch` / `downgradePatch`.

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
- `Version`: the version the code runs at. In `development` and `test` (`STAMHOOFD.environment`) this is `ReleasedVersion + 1`, so `...NextVersion` fields are active and their hooks run. In `production` and `staging` it equals `ReleasedVersion`, where those fields are still omitted on encode and ignored on decode. That is only until the release: once `ReleasedVersion` is bumped, production and staging include the fields too, at the bumped version.

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

The last two properties are type changes: see [Changing the type of a field](#changing-the-type-of-a-field).

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
