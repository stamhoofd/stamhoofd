import { field } from '../decorators/Field.js';
import { ArrayDecoder } from '../structs/ArrayDecoder.js';
import IntegerDecoder from '../structs/IntegerDecoder.js';
import StringDecoder from '../structs/StringDecoder.js';
import { AutoEncoder } from './AutoEncoder.js';
import { Cloneable, cloneObject } from './Cloneable.js';

class Dog extends AutoEncoder {
    @field({ decoder: IntegerDecoder })
    @field({ decoder: StringDecoder, version: 2, upgrade: (int: number) => 'DOG' + int, downgrade: (str: string) => parseInt(str.substring(3)) })
    id = '';

    @field({ decoder: StringDecoder, defaultValue: () => '' })
    @field({ decoder: StringDecoder, version: 2, field: 'breed', defaultValue: () => '' })
    name: string | undefined;

    @field({ decoder: new ArrayDecoder(StringDecoder) })
    friendIds: string[] = [];

    @field({ decoder: new ArrayDecoder(Dog) })
    friends: Dog[] = [];

    @field({ decoder: Dog, optional: true })
    bestFriend?: Dog;

    /// Test support and compile support for getIdentifier (should work with and without it)
    getIdentifier(): number {
        return parseInt(this.id.substring(3));
    }
}

describe('Cloneable', () => {
    test('Clone an AutoEncoder object', () => {
        const aFriend = Dog.create({ id: 'DOG2', name: 'friend', friendIds: [], friends: [] });
        const dog = Dog.create({ id: 'DOG1', name: 'dog', friendIds: ['sdgsdg', '84sdg95', 'sdg95sdg26s'], friends: [aFriend] });
        expect(aFriend.clone()).toEqual(aFriend);
        expect(dog.clone()).toEqual(dog);

        expect(dog.clone().patch).toBeDefined();
        expect(dog.clone()).toBeInstanceOf(Dog);
        expect(dog.clone().friends[0]).toBeInstanceOf(Dog);

        expect(dog.clone()).not.toBe(dog);
        expect(dog.clone().friends[0]).not.toBe(aFriend);
    });

    test('Clone an array', () => {
        const aFriend = Dog.create({ id: 'DOG2', name: 'friend', friendIds: [], friends: [] });
        const dog = Dog.create({ id: 'DOG1', name: 'dog', friendIds: ['sdgsdg', '84sdg95', 'sdg95sdg26s'], friends: [aFriend] });
        expect(cloneObject([aFriend as Cloneable, dog as Cloneable, 'test'])).toEqual([aFriend, dog, 'test']);
    });

    test('Clone a string', () => {
        expect(cloneObject('hallo')).toEqual('hallo');
    });

    test('Clone null', () => {
        expect(cloneObject(null)).toEqual(null);
    });

    test('Clone undefined', () => {
        expect(cloneObject(undefined)).toEqual(undefined);
    });

    test('Clone date', () => {
        const obj = new Date();
        expect(cloneObject(obj)).toEqual(obj);
        expect(cloneObject(obj)).not.toBe(obj);
    });

    test('Clone plain object', () => {
        const obj = {
            name: 'Test',
            id: 1234,
            randomValue: undefined,
        };
        expect(cloneObject(obj)).toEqual(obj);
        expect(cloneObject(obj)).not.toBe(obj);
    });

    test('Cloning an object with constructor', () => {
        class Test {
            name: string;
            id: number;

            hallo() {
                return this.name + ' ' + this.id;
            }
        }
        const obj = new Test();
        obj.name = 'test';
        obj.id = 12345945;
        expect(cloneObject(obj as any)).toEqual(obj);
        expect(cloneObject(obj as any)).toBeInstanceOf(Test);
        expect(cloneObject(obj as any)).not.toBe(obj);
        expect(cloneObject(obj as any).hallo).not.toBeUndefined();

        // Default objects
        expect(obj.toString).not.toBeUndefined();
        expect(cloneObject(obj as any).toString).not.toBeUndefined();
    });
});
