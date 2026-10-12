# Local storage

Use [Storage](../../frontend/shared/networking/src/Storage.ts), not direct `localStorage`, so platform bootstrap can select the implementation. Its containers accept strings and expose an asynchronous interface.

`keyValue` is for general/disposable data, `secure` for tokens/keys, and `keychain` for many keys. These are roles, **not namespaces**: browser defaults share localStorage. Mobile bootstrap replaces `secure` and `keychain` with [Capacitor Preferences](../../frontend/app/mobile/src/CapacitorStorage.ts), not an encrypted keychain. Do not assume the `secure` name provides encryption or protection from JavaScript access.

## Persist a versioned structure

Use a version box for data that must survive application upgrades. See the [encoding library's versioning guide](https://github.com/SimonBackx/simple-encoding/blob/master/docs/versioning.md) for its stored version and decoding contracts.

```ts
import { type Decoder, EncodeMedium, ObjectData, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { Storage } from '@stamhoofd/networking/Storage';
import { UserWithMembers, Version } from '@stamhoofd/structures';

async function cacheUser(user: UserWithMembers) {
    await Storage.secure.setItem('user', JSON.stringify(
        new VersionBox(user).encode({ version: Version, medium: EncodeMedium.Database }),
    ));
}

async function restoreUser(): Promise<UserWithMembers | null> {
    const json = await Storage.secure.getItem('user');
    if (json === null) return null;
    try {
        const decoder = new VersionBoxDecoder<UserWithMembers>(UserWithMembers as Decoder<UserWithMembers>);
        return new ObjectData(JSON.parse(json), {
            version: 0,
            medium: EncodeMedium.Database,
        }).decode(decoder).data;
    }
    catch (error) {
        console.error(error);
        await Storage.secure.removeItem('user');
        return null;
    }
}
```

The outer decoding context starts at version zero; the box supplies the stored payload's version. `.data` is the decoded user, not the box itself. Use the Database medium for persistence. Treat cached data as recoverable: parsing/decoding can fail after corrupt or incompatible storage; clear the cache and reload authoritative data. Storage read/write/removal failures also need handling in the calling workflow.
