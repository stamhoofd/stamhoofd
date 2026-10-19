# Storing data locally in the browser/app

Always use the `Storage` class to store things in the frontend. It has a couple of different storage keys where you can store data. For example `secure` will store things in a safer place in the app. In the web app, it stores the data in localstorage.

> Avoid using localstorage directly

### Storing data

For example if you want to cache the currently signed in user:

```typescript
import { VersionBox, Version, EncodeMedium } from '@stamhoofd/structures';
import { Storage } from '@stamhoofd/networking';

await Storage.secure.setItem(
	'user', 
	JSON.stringify(
		new VersionBox(this.user).encode({ version: Version, medium: EncodeMedium.Database })
	)
);
```

### Retrieving data

```typescript
const json = await Storage.secure.getItem('user');
if (json) {
    try {
        const parsed = JSON.parse(json);
        const decoder = new VersionBoxDecoder(UserWithMembers as Decoder<UserWithMembers>);
        this.user = new ObjectData(parsed, { version: 0, medium: EncodeMedium.Database }).decode(decoder).data;
        return;
    }
    catch (e) {
		    // Do something with the error
        console.error(e);
    }
}
```
