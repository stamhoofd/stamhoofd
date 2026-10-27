import { AutoEncoder } from '../classes/AutoEncoder.js';
import { ObjectData } from '../classes/ObjectData.js';
import { AutoEncoderPatchType, PatchMap } from '../classes/Patchable.js';
import { field } from '../decorators/Field.js';
import { MapDecoder } from './MapDecoder.js';
import StringDecoder from './StringDecoder.js';

class Cat extends AutoEncoder {
    @field({ decoder: StringDecoder })
    color = '';

    @field({ decoder: StringDecoder })
    name = '';
}

class Dog extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id = '';

    @field({ decoder: new MapDecoder(StringDecoder, Cat) })
    friends = new Map<string, Cat>();
}

class OtherDog extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id = '';

    @field({ decoder: new MapDecoder(StringDecoder, new MapDecoder(StringDecoder, Cat)) })
    friends = new Map<string, Map<string, Cat>>();
}
class OtherNullableDog extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id = '';

    @field({ decoder: new MapDecoder(StringDecoder, new MapDecoder(StringDecoder, Cat)), nullable: true })
    friends: Map<string, Map<string, Cat>> | null = null;
}

describe('MapDecoder', () => {
    test('it can patch map items', () => {
        const cat1 = Cat.create({
            color: 'gray',
            name: 'Cat1',
        });

        const cat2 = Cat.create({
            color: 'red',
            name: 'Cat2',
        });

        const dog = Dog.create({
            id: '123',
        });
        dog.friends.set('best', cat1);
        dog.friends.set('second', cat2);

        const patch = Dog.patch({});
        patch.friends.set('best', Cat.patch({
            color: 'green',
        }));

        const patchedDog = dog.patch(patch);

        expect(patchedDog.friends.get('best')!.color).toEqual('green');
        expect(patchedDog.friends.get('best')!.name).toEqual('Cat1');
        expect(patchedDog.friends.get('second')).toEqual(cat2);

        // did not alter original
        expect(dog.friends.get('best')!.color).toEqual('gray');
        expect(dog.friends.get('best')!.name).toEqual('Cat1');
        expect(cat1.color).toEqual('gray');
        expect(cat1.name).toEqual('Cat1');

        // Can do the same with decoded form
        const encoded = JSON.parse(JSON.stringify(patch.encode({ version: 0 })));
        const decoded = Dog.patchType().decode(new ObjectData(encoded, { version: 0 }));

        const patchedDog2 = dog.patch(decoded);
        expect(patchedDog).toEqual(patchedDog2);

        expect(patchedDog2.friends.get('best')!.color).toEqual('green');
        expect(patchedDog2.friends.get('best')!.name).toEqual('Cat1');
        expect(patchedDog2.friends.get('second')).toEqual(cat2);
    });

    test('it can set map items', () => {
        const cat1 = Cat.create({
            color: 'gray',
            name: 'Cat1',
        });

        const cat2 = Cat.create({
            color: 'red',
            name: 'Cat2',
        });

        const dog = Dog.create({
            id: '123',
        });
        dog.friends.set('best', cat1);
        dog.friends.set('second', cat2);

        const patch = Dog.patch({});
        patch.friends.set('best', Cat.create({
            name: 'Green cat',
            color: 'green',
        }));

        const patchedDog = dog.patch(patch);

        expect(patchedDog.friends.get('best')!.color).toEqual('green');
        expect(patchedDog.friends.get('best')!.name).toEqual('Green cat');
        expect(patchedDog.friends.get('second')).toEqual(cat2);

        // did not alter original
        expect(dog.friends.get('best')!.color).toEqual('gray');
        expect(dog.friends.get('best')!.name).toEqual('Cat1');
        expect(cat1.color).toEqual('gray');
        expect(cat1.name).toEqual('Cat1');

        // Can do the same with decoded form
        const encoded = JSON.parse(JSON.stringify(patch.encode({ version: 0 })));
        const decoded = Dog.patchType().decode(new ObjectData(encoded, { version: 0 }));

        const patchedDog2 = dog.patch(decoded);
        expect(patchedDog).toEqual(patchedDog2);

        expect(patchedDog2.friends.get('best')!.color).toEqual('green');
        expect(patchedDog2.friends.get('best')!.name).toEqual('Green cat');
        expect(patchedDog2.friends.get('second')).toEqual(cat2);
    });

    test('it can delete map items', () => {
        const cat1 = Cat.create({
            color: 'gray',
            name: 'Cat1',
        });

        const cat2 = Cat.create({
            color: 'red',
            name: 'Cat2',
        });

        const dog = Dog.create({
            id: '123',
        });
        dog.friends.set('best', cat1);
        dog.friends.set('second', cat2);

        const patch = Dog.patch({});
        patch.friends.set('best', null);

        const patchedDog = dog.patch(patch);

        expect(patchedDog.friends.has('best')).toBe(false);
        expect(patchedDog.friends.get('second')).toEqual(cat2);

        // did not alter original
        expect(dog.friends.get('best')!.color).toEqual('gray');
        expect(dog.friends.get('best')!.name).toEqual('Cat1');
        expect(cat1.color).toEqual('gray');
        expect(cat1.name).toEqual('Cat1');

        // Can do the same with decoded form
        const encoded = JSON.parse(JSON.stringify(patch.encode({ version: 0 })));
        const decoded = Dog.patchType().decode(new ObjectData(encoded, { version: 0 }));

        const patchedDog2 = dog.patch(decoded);
        expect(patchedDog).toEqual(patchedDog2);

        expect(patchedDog2.friends.has('best')).toBe(false);
        expect(patchedDog2.friends.get('second')).toEqual(cat2);
    });

    test('it can override a map', () => {
        const cat1 = Cat.create({
            color: 'gray',
            name: 'Cat1',
        });

        const cat2 = Cat.create({
            color: 'red',
            name: 'Cat2',
        });

        const dog = Dog.create({
            id: '123',
        });
        dog.friends.set('best', cat1);
        dog.friends.set('second', cat2);

        const patch = Dog.patch({
            friends: new Map() as any,
        });

        const patchedDog = dog.patch(patch);

        expect(patchedDog.friends.size).toBe(0);

        // did not alter original
        expect(dog.friends.get('best')!.color).toEqual('gray');
        expect(dog.friends.get('best')!.name).toEqual('Cat1');
        expect(cat1.color).toEqual('gray');
        expect(cat1.name).toEqual('Cat1');

        // Can do the same with decoded form
        const encoded = JSON.parse(JSON.stringify(patch.encode({ version: 0 })));
        const decoded = Dog.patchType().decode(new ObjectData(encoded, { version: 0 }));

        const patchedDog2 = dog.patch(decoded);
        expect(patchedDog).toEqual(patchedDog2);

        expect(patchedDog2.friends.size).toBe(0);
    });

    test('it can stack multiple patches', () => {
        const cat1 = Cat.create({
            color: 'gray',
            name: 'Cat1',
        });

        const cat2 = Cat.create({
            color: 'red',
            name: 'Cat2',
        });

        const dog = Dog.create({
            id: '123',
        });
        dog.friends.set('best', cat1);
        dog.friends.set('second', cat2);

        const patch = Dog.patch({});
        patch.friends.set('best', Cat.patch({ color: 'c' }));
        patch.friends.set('second', null);

        const patch2 = Dog.patch({});
        patch2.friends.set('best', Cat.patch({ name: 'n' }));
        patch2.friends.set('second', Cat.patch({ name: 'late' }));

        const combinedPatch = patch.patch(patch2);
        expect(combinedPatch.friends.get('best')!.name).toEqual('n');
        expect(combinedPatch.friends.get('best')!.color).toEqual('c');
        expect(combinedPatch.friends.get('second')).toBe(null);

        const patch3 = Dog.patch({});
        patch3.friends.set('second', Cat.create({ name: 'new' }));

        const combinedPatch2 = combinedPatch.patch(patch3);
        expect(combinedPatch2.friends.get('second')).toEqual(Cat.create({ name: 'new' }));

        const patchedDog = dog.patch(combinedPatch);

        expect(patchedDog.friends.get('best')!.name).toEqual('n');
        expect(patchedDog.friends.get('best')!.color).toEqual('c');

        // Can do the same with decoded form
        const encoded = JSON.parse(JSON.stringify(combinedPatch.encode({ version: 0 })));
        const decoded = Dog.patchType().decode(new ObjectData(encoded, { version: 0 }));

        const patchedDog2 = dog.patch(decoded);
        expect(patchedDog).toEqual(patchedDog2);
    });

    test('it can stack multiple patches of a map with a map', () => {
        const cat1 = Cat.create({
            color: 'gray',
            name: 'Cat1',
        });

        const cat2 = Cat.create({
            color: 'red',
            name: 'Cat2',
        });

        const dog = OtherDog.create({
            id: '123',
            friends: new Map(),
        });

        const bb = new Map<string, Cat>();
        bb.set('best', cat1);

        dog.friends.set('best', bb);
        dog.friends.set('second', new Map());

        const patch = OtherDog.patch({});
        const pm = new PatchMap<string, AutoEncoderPatchType<Cat>>();
        pm.set('best', Cat.patch({ color: 'c' }));
        patch.friends.set('best', pm);
        patch.friends.set('second', null);

        const patch2 = OtherDog.patch({});

        const combinedPatch = patch2.patch(patch);
        expect(combinedPatch.encode({ version: 0 })).toEqual(patch.encode({ version: 0 }));

        const patchedDog = dog.patch(combinedPatch);

        expect(patchedDog.friends.get('best')!.get('best')!.name).toEqual('Cat1');
        expect(patchedDog.friends.get('best')!.get('best')!.color).toEqual('c');

        // Can do the same with decoded form
        const encoded = JSON.parse(JSON.stringify(combinedPatch.encode({ version: 0 })));
        const decoded = OtherDog.patchType().decode(new ObjectData(encoded, { version: 0 }));
        expect(decoded).toEqual(combinedPatch);

        const patchedDog2 = dog.patch(decoded);
        expect(patchedDog2).toEqual(patchedDog);
    });

    test('it creates keys on stacked maps', () => {
        const cat1 = Cat.create({
            color: 'gray',
            name: 'Cat1',
        });

        const cat2 = Cat.create({
            color: 'red',
            name: 'Cat2',
        });

        const dog = OtherDog.create({
            id: '123',
            friends: new Map(),
        });

        const patch = OtherDog.patch({});

        const pm = new PatchMap<string, AutoEncoderPatchType<Cat>>();
        pm.set('second', cat1);
        patch.friends.set('best', pm);

        const patch2 = OtherDog.patch({});

        const combinedPatch = patch2.patch(patch);
        expect(combinedPatch.encode({ version: 0 })).toEqual(patch.encode({ version: 0 }));

        const patchedDog = dog.patch(combinedPatch);

        expect(patchedDog.friends.get('best')!.get('second')!.name).toEqual('Cat1');
        expect(patchedDog.friends.get('best')!.get('second')!.color).toEqual('gray');

        expect(patchedDog.friends.get('best') instanceof PatchMap).toEqual(false);
        expect(patchedDog.friends instanceof PatchMap).toEqual(false);

        // Can do the same with decoded form
        const encoded = JSON.parse(JSON.stringify(combinedPatch.encode({ version: 0 })));
        const decoded = OtherDog.patchType().decode(new ObjectData(encoded, { version: 0 }));

        const patchedDog2 = dog.patch(decoded);
        expect(patchedDog).toEqual(patchedDog2);
    });

    test('it creates keys nullable stacked maps', () => {
        const cat1 = Cat.create({
            color: 'gray',
            name: 'Cat1',
        });

        const cat2 = Cat.create({
            color: 'red',
            name: 'Cat2',
        });

        const dog = OtherNullableDog.create({
            id: '123',
            friends: null,
        });

        const patch = OtherNullableDog.patch({});

        const pm = new PatchMap<string, AutoEncoderPatchType<Cat>>();
        pm.set('second', cat1);
        patch.friends!.set('best', pm);

        const patch2 = OtherNullableDog.patch({});

        const combinedPatch = patch2.patch(patch);
        expect(combinedPatch.encode({ version: 0 })).toEqual(patch.encode({ version: 0 }));

        const patchedDog = dog.patch(combinedPatch);

        expect(patchedDog.friends!.get('best')!.get('second')!.name).toEqual('Cat1');
        expect(patchedDog.friends!.get('best')!.get('second')!.color).toEqual('gray');

        expect(patchedDog.friends!.get('best') instanceof PatchMap).toEqual(false);
        expect(patchedDog.friends instanceof PatchMap).toEqual(false);

        // Can do the same with decoded form
        const encoded = JSON.parse(JSON.stringify(combinedPatch.encode({ version: 0 })));
        const decoded = OtherDog.patchType().decode(new ObjectData(encoded, { version: 0 }));

        const patchedDog2 = dog.patch(decoded);
        expect(patchedDog).toEqual(patchedDog2);
    });

    test('it does not create keys on stacked maps when there are no changes', () => {
        const dog = OtherDog.create({
            id: '123',
            friends: new Map(),
        });

        const patch = OtherDog.patch({});

        const pm = new PatchMap<string, null>();
        pm.set('second', null);
        patch.friends.set('best', pm);

        const patch2 = OtherDog.patch({});

        const combinedPatch = patch2.patch(patch);
        expect(combinedPatch.encode({ version: 0 })).toEqual(patch.encode({ version: 0 }));

        const patchedDog = dog.patch(combinedPatch);

        expect(patchedDog.friends.size).toEqual(0);
    });
});
