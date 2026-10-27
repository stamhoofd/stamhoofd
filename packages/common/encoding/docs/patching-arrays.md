# Patching arrays

## What is a PatchableArray?

A smart patch type that tracks array modifications including:
- Inserting new items
- Moving items
- Deleting items
- Changing (patching) specific items

**Quick example: Adding an item to an array**

The most basic usage involves manually creating a patchable array. You normally won't need to do this, except in rare cases.

```typescript
const array = ["apple"];
const patchableArray = new PatchableArray<string, string, string>();

// Add "cherry" to the end
patchableArray.addPut("cherry");

// Apply the patch
const newArray = patchableArray.applyTo(array);
console.log(newArray); // ["apple", "cherry"]
```

---

## Arrays in objects

Given an object that has array properties, PatchableArray will automatically be used, with TypeScript support out of the box.

```typescript
class Dog extends AutoEncoder {
		@field({ decoder: StringDecoder });
		id: string;
		
		@field({ decoder: StringDecoder });
		name: string;
		
		@field({ decoder: new ArrayDecoder(StringDecoder) });
		tags: string[] = [];
		
		@field({ decoder: new ArrayDecoder(Dog) });
		friends: Dog[] = [];
}
```

```typescript
const pablo = Dog.create({ name: "Pablo" });
const otto = Dog.create({ name: "Otto" });

const patch = Dog.patch({});
patch.tags.addPut('friendly');
patch.friends.addPut(otto);

const patchedPablo = pablo.patch(patch);
```

## Supported array types

PatchableArray works with:
- Simple arrays (`string[]` or `number[]`)
- Arrays of encodeable objects with `Identifiable<Id>`

    <details>

    <summary>Definition of <code>Identifiable&lt;Id&gt;</code></summary>

    ```typescript
    type Identifiable<P extends string | number> = { 
    	id: P 
    };
    // tl;dr; an object with an id property
    ```

    </details>

    - Basic objects: Can insert, delete, and move items by ID
    - Advanced objects (implementing both `Identifiable<Id>` and `Patchable<Patch>`): Can also patch individual items

- All other array types: Only complete array replacement is supported

The type signature is:<br>`PatchableArray<Id extends string|number, Put, Patch>`

---

## Usage

<details>

<summary><strong>Inserting at the end of an array</strong></summary>

```typescript
// Scalar data types (string & number)
patchableArray.addPut("cherry");
```

```typescript
// Objects that implement Identifiable<Id>
patchableArray.addPut(myObject)
```

</details>

<details>

<summary><strong>Inserting at the beginning of an array</strong></summary>

```typescript
// Scalar data types (string & number)
patchableArray.addPut("cherry", null);
```

```typescript
// Objects that implement Identifiable<Id>
patchableArray.addPut(myObject, null)
```

</details>

<details>

<summary><strong>Inserting after an item</strong></summary>

```typescript
// Scalar data types (string & number)
patchableArray.addPut("cherry", "apple"); // insert after apple
```

```typescript
// Objects that implement Identifiable<Id>
// insert myObject after item with id 123
patchableArray.addPut(myObject, 123); 
```

</details>

<details>

<summary><strong>Patching an item</strong></summary>

```typescript
// Scalar data types (string & number)
// not possible
```

```typescript
// Objects that implement Identifiable<Id> and are patchable
const patch = MyObject.patch({ id: 2, name: "Changed name" });
patchableArray.addPatch(patch); // Note that the ID should be set in the patch
```

</details>

<details>

<summary><strong>Deleting an item</strong></summary>

```typescript
// Scalar data types (string & number)
patchableArray.addDelete("cherry"); 
```

```typescript
// Objects that implement Identifiable<Id>
patchableArray.addDelete(2); // Delete item with id 2
```

</details>

<details>

<summary><strong>Moving an item</strong></summary>

```typescript
// Scalar data types (string & number)
patchableArray.addMove("cherry", "apple"); // Move cherry after apple 
patchableArray.addMove("cherry", null); // Move cherry to the start
patchableArray.addMove("cherry", "inexisting item"); // Move cherry to the end
```

```typescript
// Objects that implement Identifiable<Id>
patchableArray.addMove(123, 111); // Move item with id 123 after item with id 111
patchableArray.addMove(123, null); // Move item with id 123 to the start
patchableArray.addMove(123, 0); // Move item with id 123 to the end if no item is found with id 0
```

</details>

<details>

<summary><strong>Patching/merging a PatchableArray</strong></summary>

A PatchableArray is patchable by itself. Which means you can easily merge two patchable arrays:

```typescript
const array: string[] = ["apple"];
const patchableArray1 = new PatchableArray<string, string, string>();
const patchableArray2 = new PatchableArray<string, string, string>();

patchableArray1.addPut("cherry");
patchableArray2.addPut("banana");

const mergedPatchableArray = patchableArray1.patch(patchableArray2);

const newArray = mergedPatchableArray.applyTo(array);
// or
const newArray = patchObject(array, mergedPatchableArray);

// result
console.log(newArray); // ["apple", "cherry", "banana"]
```

</details>

## Advanced

### Array of objects that don’t have an `id` property

For arrays with items that don’t implement `Identifiable` (= no id property), you can only overwrite an array.

**Type definitions: House + Street**

```typescript
class Street extends AutoEncoder {
		@field({ decoder: StringDecoder });
		id: string;
		
		@field({ decoder: StringDecoder });
		name: string;
		
		@field({ decoder: new ArrayDecoder(House) });
		houses: House[] = [];
}

class House extends AutoEncoder {
		@field({ decoder: IntegerDecoder });
		nr: number;
}
```

**Example**

```typescript
const street = Street.create({ name: "Kerkstraat" });

// 🚫 This does not work
// Changing houses can not use PatchableArray
const patch = Street.patch({});
patch.houses.addPut(House.create({ nr: 1 }));
patch.houses.addPut(House.create({ nr: 2 }));

// ✅ Instead, you always need to set the property,
// because it does not have an 'id' property
const patch = Street.patch({
		houses: [
				House.create({ nr: 1 }),
				House.create({ nr: 2 })
		]
});
```

### **Overwriting** an array

You can manually overwrite an array that would normally use `PatchableArray` (arrays of string, number or Identifiable\<Id\>).

> Manually add `as any` - because there are some TypeScript issues in the upstream library to support this, for now you’ll need to cast to any. <br>*If this ever changes, please delete this note.*

```typescript
const pablo = Dog.create({ name: "Pablo", ... });

// 🧹 Clearing an array
const patch = Dog.patch({ friends: [] as any });
// or directly
const patchedDog = pablo.patch({ friends: [] as any });

// ⤵️ Setting with values
const patch = Dog.patch({ tags: ["friendly", "kind"] as any });
// or directly
const patchedDog = pablo.patch({ tags: ["friendly", "kind"] as any });
```

### Inserting items that already exist (since `v2.23.0`)

When inserting items in an array that already exist (by id), the item will be replaced instead of duplicating an item in the array.

### PatchableArrays in TypeScript

The PatchebleArray class has 3 generic types: Id, Put, Patch. It can be a hassle to always fill these in, and your code can become long. In the situation where you need to manually create a patchable array or for some reason reference the type, you can use `PatchableArrayAutoEncoder<AutoEncoder>` when you have an array of AutoEncoder classes, you can shorten this:

```typescript
const array: PatchableArrayAutoEncoder<Dog> = new PatchableArray();
array.addPut(
		Dog.create({name: "Pablo"})
);
```

---

## Do and don’ts

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
