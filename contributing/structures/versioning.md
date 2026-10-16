# Versioning Stamhoofd structures

Read the [library versioning guide](https://github.com/SimonBackx/simple-encoding/blob/master/docs/versioning.md) before changing a structure. It covers versioned decorators, upgrade/downgrade callbacks, stored version envelopes, and deprecated fields. The rules below concern Stamhoofd's release process rather than the library API.

## New fields during development

The current API/storage version is [Version](../../shared/structures/src/Version.ts). New fields use the global `NextVersion` helper:

```ts
@field({ decoder: StringDecoder, ...NextVersion })
description = '';
```

Do not manually increment `Version` for each new field. The [release script](../../.development/increase-structures-version.js) increments the version and replaces `...NextVersion` in field decorators with a concrete `version` number. This avoids conflicting version allocations across branches.

At runtime, `NextVersion` currently uses `Version`; it is a release marker, not a separately allocated migration version. Development data stored with this temporary definition can lose those new values after release. Do not treat it as a shortcut for changing the type or meaning of an existing field. Agree the version and upgrade/downgrade plan with a reviewer before committing those changes; do not commit an unreviewed manual version bump.

## Encoding and decoding

For network data, use the version agreed by the request/response protocol. For persisted data, retain the version it was encoded with. Do not decode older JSON using today's `Version` just because it is the current constant.

Use `VersionBox` to store the format version with JSON. Its decoder returns a wrapper; the restored structure is in `.data`:

```ts
import { type Decoder, ObjectData, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { User, Version } from '@stamhoofd/structures';

const user = User.create({ email: 'example@example.com' });
const json = JSON.stringify(new VersionBox(user).encode({ version: Version }));
const restored = new VersionBoxDecoder<User>(User as Decoder<User>).decode(
    new ObjectData(JSON.parse(json), { version: 0 }),
).data;
```

Encoding/decoding can also depend on the medium. Use the correct network/database context for the caller, and let existing request, model, and storage helpers handle it when possible. See [manual implementations](manual-encoding.md) for examples of medium-dependent behavior.

## Deprecated fields

Keep definitions needed by older clients and stored data. Mark obsolete fields `@deprecated`; if their property name gets in the way, rename the property while retaining its encoded `field` key. Removing older definitions requires an explicit compatibility decision, not just the absence of current callers.
