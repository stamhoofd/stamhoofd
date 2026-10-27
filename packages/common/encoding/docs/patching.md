# Patching data

## What is patching?

Patching allows modifying specific properties of an object without changing the original object⁠. It's like creating a list of changes that can be stored and even sent over the network to the API.  The list of changes can then be applied to one or multiple objects.

All AutoEncoder objects ([Writing AutoEncoder classes](autoencoder.md)) are patchable by default. Other objects can be made patchable by implementing the [Patchable interface](#patchable-interface).

This is how it works:
- Create or reference an object with initial values
- Create a patch for the properties that should be changed
- Apply the patch to the object to create a new object with updated values

**Why?**

In the UI, you can maintain three variables simultaneously: the original object, the patch, and the patched object. Only the patch gets modified as changes are being made in the UI. While the patched object updates automatically (using a computed property in Vue). The patch is sent to the API over the network when the save button is clicked.

This pattern enables complex nested editing views. For example, when editing a member, you track their patch. Within the same view, you can open another view to edit the member's emergency contact. Instead of saving the emergency contact's changes to the network, you can pass the emergency contact's patch back to the member editing view. If you cancel the edit, you simply discard the emergency contact's patch.
- Only changed data is sent to the server, reducing network traffic
- Easy undo functionality - discarding the patch instantly reverts all changes
- Possible to edit data very deeply without sending any data to the network
- Enables multiple users to edit the same data at once while avoiding most conflicts (e.g. one user adds a new category, while a different user moved some categories around)
- Possible to store your patch locally in case of network issues (used for ticket scanning in Stamhoofd)
- View dependencies can be minimized

The full pattern is described in [UI: Edit views](https://github.com/stamhoofd/stamhoofd/blob/main/contributing/patterns/edit-views.md)

**<br>Simple Example:**

<details>

<summary>MyObject</summary>

```typescript
class MyObject extends AutoEncoder {
		@field({decoder: IntegerDecoder})
		id: number
		
		@field({decoder: StringDecoder})
		name: string
		
		@field({decoder: IntegerDecoder})
		age: number
}
```

</details>

```typescript
// 1. Creating an initial object
const myObject = MyObject.create({ id: 1, name: "Hello world", age: 20 });

// 2. Creating a simple patch
const patch = MyObject.patch({ name: "Changed name" });

// 3. Applying the patch
const patchedObject = myObject.patch(patch);
console.log(patchedObject);
// { id: 1, name: "Changed name", age: 20 }

// 4. Demonstrating immutability
console.log(patchedObject === myObject); // false
console.log(myObject); // { id: 1, name: "Hello world", age: 20 }

// 5. Chaining patches
const patchedPatch = patch.patch({ age: 19 });
console.log(patchedPatch); // { name: "Changed name", age: 19 }

const patchedObject2 = myObject.patch(patchedPatch);
console.log(patchedObject); // { id: 1, name: "Changed name", age: 20 }
```

**Important behavior**
- The original object remains unchanged when patching - it creates a new object instead
- You can chain patches together by patching a patch object itself
- When patching, only the specified properties are modified - other properties keep their original values

---

## Special data types

[Patching arrays](patching-arrays.md)

Missing docs: patching maps

---

## Patching in the frontend

The frontend has some helpers to avoid boilerplate code when patching data.

[Patching inside views](https://github.com/stamhoofd/stamhoofd/blob/main/contributing/frontend/patching.md)

---

## Advanced

### Patches in TypeScript

In TypeScript sometimes you’ll need to reference the patch type of a given class.

**AutoEncoder classes**

You’ll need to use the AutoEncoderPatchType\<T\> helper:

```typescript
let expectedPatch: AutoEncoderPatchType<Dog>;

if (...) {
		expectedPatch = Dog.patch({...});
}
```

**Other patchable types**<br>Other manually patchable classes can use `PatchType`.

> You cannot use this on subclasses of `AutoEncoder` because `PatchType<Dog>` would’t properly resolve due to the sublassing of AutoEncoder and type issues in the library. The underlying reason is that PatchType auto infers the type of the patch method, but the patch method is implemented on AutoEncoder and not on your subclass such as Dog.<br>*(Something on the todo list, but tried this already a couple of times and will probably take weeks to fix)*

```typescript
let expectedPatch: PatchType<TranslatedString>;

if (...) {
		expectedPatch = ...;
}
```

### Patchable interface

In order for an object to be patchable, it needs to implement the Patchable interface:

```typescript
interface Patchable<P> {
    patch(patch: P): this;
}
```

By default any class that extends `AutoEncoder` (see [Encoding & decoding (structures)](../README.md)), is patchable.

You rarely need to manually implement the patch method yourself. As an example of a manual implementation, you can look at `TranslatedString` (`shared/structures/src/TranslatedString.ts`)

### Patching default data (since `v2.23.0`)

In some situations you want to patch a property that is possibly null, or patch a map with a key that possibly does not exist. One solution could be to check if it exists, and depending on that result, send a put instead of a patch. This works most of the time, but can cause issues when the state between the client and server is not synced. If the client has an out of date state, it is possible it could think a property is set. If it then sends a patch request to a property that does not exist, you could get an error.

<br>To fix this, we support default values. If you patch a property that is not set, it will check if there is a possible default value and then patch the default value instead and set the property to that patched value.

> Note that sending a patch to an array with an ID that does not exist in the original array will just ‘noop’ and do nothing. This won’t use the default value, even if you manually override the getDefault method.

Default values work out of the box in most situations when using AutoEncoder (when you define a default value for all properties, except some properties that will have a default value by default such as nullable properties or strings), unless your property is Identifiable (it has an id property). In that case it would not work because that could cause unwanted issues. If you still want to have a default value in those situations, you can override the `getDefaultValue` method of your AutoEncoder subclass.

```typescript
class Friend extends AutoEncoder {
    @field({ decoder: StringDecoder })
    name: string;
}

class Dog extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id = '';

    @field({ decoder: StringDecoder })
    name: string = '';

    @field({ decoder: Friend, nullable: true })
    friend: Friend | null = null;
}

const myDog = Dog.create({
    id: 'dog1',
    name: 'Fido',
});

const result = myDog.patch({
    friend: Friend.patch({
        name: 'Buddy',
    }),
});

// Results in a new friend instead of an error
```

This will throw an error because there is no default object (Dog is Identifiable):

```typescript
class Dog extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id = '';

    @field({ decoder: StringDecoder })
    name: string = '';

    @field({ decoder: Dog, nullable: true })
    friend: Dog | null = null;
}

const myDog = Dog.create({
    id: 'dog1',
    name: 'Fido',
});

// Patching the name of the friend would throw an error
expect(() => {
    myDog.patch({
        friend: Dog.patch({
            name: 'Buddy',
        }),
    });
}).toThrow(STExpect.simpleError({
    code: 'cannot_patch_null',
}));
```

---

## Do and don’ts

#### Avoid manually adjusting a patch, but chain patches instead

It is bad practice to adjust an existing patch. It will result in hard to read code. It will also result in longer code when dealing with arrays or more complex data structures.

```typescript
let patch = MyObject.patch({ name: "Changed name" });

// 🚫 Don't
patch.name = "Something";

// ✅ Do
patch = patch.patch({ name: "Something" });
```

```typescript
let patch = MyObject.patch({ name: "Changed name" });

// 🚫 Don't
patch.friend = MyObject.patch({
		name: "test"
});

// ✅ Do
patch = patch.patch({ 
		friend: MyObject.patch({
				name: "test"
		})
});
```

```typescript
const pablo = Dog.create({ 
		id: "1", 
		name: "Pablo", 
		tags: ["friendly"],
		friends: [
				Dog.create({ id: "2", name: "Otto" })
		]
});

// Create a patch to store our changes
let patch = Dog.patch({});
patch.friends.addPatch(Dog.patch({ id: "2", name: "Otto 2" }));

// 🚫 Don't do something like this
if (patch.friends instanceof PatchebleArray) {
		const otto = patch.friends.getPuts().find(d => d.id === "2");
		if (otto) {
				otto.tags.addPut("happy");
		}
}

// ✅ Do: 'patch' the 'patch'
const patchOtto = Dog.patch({});
patchOtto.tags.addPut("happy");

const newPatch = Dog.patch({});
newPatch.friends.addPatch(patchOtto);
patch = patch.patch(newPatch);
```

#### Avoid creating manual PatchableArray’s or PatchableMaps

In most situations it is cleaner and shorter to not manually create a PatchableArray.

```typescript
const dog = Dog.create({ name: "Pablo", tags: ["friendly"] });

// 🚫 Don't
const patchTags = new PatchableArray(...);
patchTags.addPut("kind");
const patch = Dog.patch({
		tags: patchTags
});

// ✅ Do
const patch = Dog.patch({});
patch.tags.addPut("kind");
```
