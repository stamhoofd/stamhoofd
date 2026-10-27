import { Decoder } from './Decoder.js';

import { field } from '../decorators/Field.js';
import { ArrayDecoder } from '../structs/ArrayDecoder.js';
import { EnumDecoder } from '../structs/EnumDecoder.js';
import IntegerDecoder from '../structs/IntegerDecoder.js';
import { PatchableArray } from '../structs/PatchableArray.js';
import StringDecoder from '../structs/StringDecoder.js';
import { AutoEncoder } from './AutoEncoder.js';
import { Data } from './Data.js';
import { Encodeable } from './Encodeable.js';
import { EncodeContext } from './EncodeContext.js';
import { ObjectData } from './ObjectData.js';
import { AutoEncoderPatchType, PartialWithoutMethods, PatchableArrayAutoEncoder, PatchType } from './Patchable.js';

enum PaymentMethod {
    PointOfSale = 'PointOfSale',
    CreditCard = 'CreditCard',
    Bancontact = 'Bancontact',
    Payconiq = 'Payconiq',
    IDeal = 'IDeal',
    ApplePay = 'ApplePay',
}

class NotPatchable implements Encodeable {
    id = '';
    constructor(id: string) {
        this.id = id;
    }

    encode(encode: EncodeContext) {
        return {
            id: this.id,
        };
    }

    static decode(data: Data) {
        return new NotPatchable(data.field('id').string);
    }
}

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

    @field({ decoder: new EnumDecoder(PaymentMethod), optional: true })
    test?: PaymentMethod;

    testMethod2(test: string) {
        return test;
    }

    toString() {
        return this.name || '';
    }

    get something() {
        return 'test';
    }
}
const DogPatch = Dog.patchType();

class Dog2 extends AutoEncoder {
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

    @field({ decoder: new ArrayDecoder(NotPatchable) })
    notPatchableFriends: NotPatchable[] = [];

    @field({ decoder: Dog, optional: true })
    bestFriend?: Dog;

    @field({ decoder: new EnumDecoder(PaymentMethod), optional: true })
    test?: PaymentMethod;

    testMethod(test: string) {
        return test;
    }

    toString() {
        return this.name || '';
    }

    get something() {
        return 'test';
    }
}
const Dog2Patch = Dog2.patchType();

type Testing = PartialWithoutMethods<Dog>;

describe('AutoEncoder', () => {
    test('encoding works and version support', () => {
        const aFriend = Dog.create({ id: 'DOG2', name: 'friend', friendIds: [], friends: [] });
        const dog = Dog.create({ id: 'DOG1', name: 'dog', friendIds: ['sdgsdg', '84sdg95', 'sdg95sdg26s'], friends: [aFriend] });
        expect(dog.encode({ version: 1 })).toEqual({
            id: 1,
            name: 'dog',
            friendIds: ['sdgsdg', '84sdg95', 'sdg95sdg26s'],
            friends: [{ id: 2, name: 'friend', friendIds: [], friends: [] }],
        });
        expect(dog.encode({ version: 2 })).toEqual({
            id: 'DOG1',
            breed: 'dog',
            friendIds: ['sdgsdg', '84sdg95', 'sdg95sdg26s'],
            friends: [{ id: 'DOG2', breed: 'friend' }],
        });
    });

    test('decoding and version support', () => {
        const data1 = new ObjectData(
            {
                id: 1,
                name: 'version test',
                friendIds: ['sdgsdg', '84sdg95', 'sdg95sdg26s'],
                friends: [{ id: 2, name: 'friend', friendIds: [], friends: [] }],
            },
            { version: 1 },
        );
        const data2 = new ObjectData(
            {
                id: 'DOG1',
                breed: 'version test',
                friendIds: ['sdgsdg', '84sdg95', 'sdg95sdg26s'],
                friends: [{ id: 'DOG2', breed: 'friend', friendIds: [], friends: [] }],
            },
            { version: 2 },
        );

        const dog1 = Dog.decode(data1);
        const dog2 = Dog.decode(data2);

        expect(dog1).toEqual(dog2);
        expect(dog1).toEqual({
            _isAutoEncoder: true,
            id: 'DOG1',
            name: 'version test',
            friendIds: ['sdgsdg', '84sdg95', 'sdg95sdg26s'],
            friends: [{
                _isAutoEncoder: true,
                id: 'DOG2',
                name: 'friend',
                friendIds: [],
                friends: [],
                bestFriend: undefined,
                test: undefined,
            }],
            bestFriend: undefined,
            test: undefined,
        });
    });

    test('if ids are not automatically converted correctly', () => {
        expect(parseInt('DOG1')).toBeNaN();
    });

    test('Automatic patch instances', () => {
        const existingFriendBestFriend = Dog.create({ id: 'DOG4', name: 'best friend', friendIds: [], friends: [] });

        const existingFriend = Dog.create({
            id: 'DOG3',
            name: 'existing friend',
            friendIds: ['sdgsdg', '84sdg95', 'sdg95sdg26s'],
            friends: [],
            // this is needed to test if existing relations are left unchanged on patches
            bestFriend: existingFriendBestFriend,
        });
        const friendDog = Dog.create({ id: 'DOG2', name: 'dog', friendIds: ['sdgsdg', '84sdg95', 'sdg95sdg26s'], friends: [] });
        const friendDogChanged = Dog.create({ id: 'DOG2', name: 'My best friend', friendIds: ['sdgsdg', '84sdg95', 'sdg95sdg26s'], friends: [] });
        const existingFriendChanged = Dog.create({
            id: 'DOG3',
            name: 'My not good friend',
            friendIds: ['sdgsdg', '84sdg95', 'sdg95sdg26s'],
            friends: [],
            bestFriend: existingFriendBestFriend,
        });

        const dog = Dog.create({ id: 'DOG1', name: 'dog', friendIds: ['sdgsdg', '84sdg95', 'sdg95sdg26s'], friends: [existingFriend] });

        const shouldCompile = DogPatch.create({ id: 'DOG1' });
        let patchDog = DogPatch.create({ id: 'DOG1', name: 'Change name' });

        patchDog = shouldCompile.patch(patchDog);
        shouldCompile.patch({});

        patchDog.friendIds.addDelete('84sdg95');
        patchDog.friendIds.addPut('test', 'sdgsdg');
        patchDog.friends.addPut(friendDog, null);

        const friendPatch = DogPatch.create({ id: 'DOG2', name: 'My best friend' });
        patchDog.friends.addPatch(friendPatch);

        const friendPatchExist = DogPatch.create({ id: 'DOG3', name: 'My not good friend' });

        patchDog.friends.addPatch(friendPatchExist);

        const patched = dog.patch(patchDog);

        expect(patched).toEqual(
            Dog.create({ id: 'DOG1', name: 'Change name', friendIds: ['sdgsdg', 'test', 'sdg95sdg26s'], friends: [friendDogChanged, existingFriendChanged] }),
        );

        // Test if patchable items are encodeable
        expect(patchDog.encode({ version: 2 })).toEqual({
            _isPatch: true,
            id: 'DOG1',
            breed: 'Change name',
            friendIds: {
                _isPatch: true,
                changes: [
                    {
                        delete: '84sdg95',
                    },
                    {
                        put: 'test',
                        afterId: 'sdgsdg',
                    },
                ],
            },
            friends: {
                _isPatch: true,
                changes: [
                    {
                        put: friendDogChanged.encode({ version: 2 }),
                        afterId: null,
                    },
                    {
                        patch: friendPatchExist.encode({ version: 2 }),
                    },
                ],
            },
        });

        // Test if patchable items are encodeable
        expect(patchDog.encode({ version: 1 })).toEqual({
            _isPatch: true,
            id: 1,
            name: 'Change name',
            friendIds: {
                _isPatch: true,
                changes: [
                    {
                        delete: '84sdg95',
                    },
                    {
                        put: 'test',
                        afterId: 'sdgsdg',
                    },
                ],
            },
            friends: {
                _isPatch: true,
                changes: [
                    {
                        put: friendDogChanged.encode({ version: 1 }),
                        afterId: null,
                    },
                    {
                        patch: friendPatchExist.encode({ version: 1 }),
                    },
                ],
            },
        });

        // Test if patchable items are decodeable
        expect(DogPatch.decode(new ObjectData(patchDog.encode({ version: 1 }), { version: 1 }))).toEqual(patchDog);
        expect(DogPatch.decode(new ObjectData(patchDog.encode({ version: 2 }), { version: 2 }))).toEqual(patchDog);
    });

    test('Patchable array', () => {
        const arr: PatchableArrayAutoEncoder<Dog> = new PatchableArray();
        const friendDog = Dog.create({ id: 'DOG2', name: 'dog', friendIds: ['sdgsdg', '84sdg95', 'sdg95sdg26s'], friends: [] });
        arr.addPut(friendDog, '3');

        const clean: Dog[] = [];
        expect(arr.applyTo(clean)).toEqual([friendDog]);
    });

    test('Patchable array 2', () => {
        const arr: PatchableArrayAutoEncoder<Dog2> = new PatchableArray();
        const friendDog = Dog2.create({ id: 'DOG2', name: 'dog', friendIds: ['sdgsdg', '84sdg95', 'sdg95sdg26s'], friends: [] });
        arr.addPut(friendDog, 'DOG3');

        const clean: Dog2[] = [];
        expect(arr.applyTo(clean)).toEqual([friendDog]);
    });

    test('Patch array fields by setting them', () => {
        const friendDog = Dog.create({ id: 'DOG2', name: 'dog', friendIds: ['sdgsdg', '84sdg95', 'sdg95sdg26s'], friends: [] });
        const patch = DogPatch.create({ friendIds: ['force-set'] as any });
        expect(friendDog.patch(patch).friendIds).toEqual(['force-set']);

        const test = Dog2.create({ id: 'DOG2', name: 'dog', notPatchableFriends: [new NotPatchable('test'), new NotPatchable('test2')], friends: [] });
        const patch2 = Dog2Patch.create({ notPatchableFriends: [new NotPatchable('hallo!')] });
        expect(test.patch(patch2).notPatchableFriends).toEqual([new NotPatchable('hallo!')]);
    });

    test('Patch or put properties', () => {
        const existingFriendBestFriend = Dog.create({ id: 'DOG4', name: 'best friend', friendIds: [], friends: [] });

        const existingFriend = Dog.create({
            id: 'DOG3',
            name: 'existing friend',
            friendIds: ['sdgsdg', '84sdg95', 'sdg95sdg26s'],
            friends: [],
            // this is needed to test if existing relations are left unchanged on patches
            bestFriend: existingFriendBestFriend,
        });

        // Check if we can do a normal patch
        const patchDog = Dog.patch({ bestFriend: Dog.patch({ name: 'Best friend 2' }) });
        const patchedDog = existingFriend.patch(patchDog);
        const patchedDog3 = existingFriend.patch({ name: 'test' });

        expect(patchedDog.bestFriend!.name).toEqual('Best friend 2');
        expect(patchedDog.bestFriend!.id).toEqual('DOG4');

        // Check if we can do a put
        const patchDog2 = Dog.patch({ bestFriend: Dog.create({ id: 'DOG5', name: 'Better best friend', friendIds: [], friends: [
            Dog.create({ id: 'DOG6', name: 'Another friend', friendIds: [], friends: [] }),
        ] }) });
        const patchedDog2 = existingFriend.patch(patchDog2);

        expect(patchedDog2.bestFriend!.name).toEqual('Better best friend');
        expect(patchedDog2.bestFriend!.id).toEqual('DOG5');

        // Try exactly the same by encdoing the patch and applying it again
        const encoded = patchDog2.encode({ version: 2 });
        const decoded = new ObjectData(encoded, { version: 2 }).decode(DogPatch as Decoder<PatchType<Dog>>);
        const patchedDog2b = existingFriend.patch(decoded);
        expect(patchedDog2b).toEqual(patchedDog2);
    });

    describe('Default and nullable properties', () => {
        beforeAll(() => {
            AutoEncoder.skipDefaultValuesVersion = 0;
        });

        test('A nullable property is not encoded', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: StringDecoder, nullable: true })
                prop: string | null;
            }

            const base = Foo.create({});
            expect(base.prop).toBeNull();

            // Encode
            const encoded = base.encode({ version: 1 });
            expect(encoded).toEqual({});
            expect(encoded).not.toHaveProperty('prop');

            // Decode
            const decoded = new ObjectData(encoded, { version: 1 }).decode(Foo as Decoder<Foo>);
            expect(decoded).toEqual(base);
            expect(decoded.prop).toBeNull();
        });

        test('An empty string is not encoded', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: StringDecoder })
                prop: string;
            }

            const base = Foo.create({});
            expect(base.prop).toEqual('');

            // Encode
            const encoded = base.encode({ version: 1 });
            expect(encoded).toEqual({});
            expect(encoded).not.toHaveProperty('prop');

            // Decode
            const decoded = new ObjectData(encoded, { version: 1 }).decode(Foo as Decoder<Foo>);
            expect(decoded).toEqual(base);
            expect(decoded.prop).toEqual('');
        });

        test('An empty string is encoded if it is nullable', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: StringDecoder, nullable: true })
                prop: string | null;
            }

            const base = Foo.create({});
            expect(base.prop).toEqual(null);

            // Set to an empty string
            base.prop = '';

            // Encode
            const encoded = base.encode({ version: 1 });
            expect(encoded).toEqual({
                prop: '',
            });

            // Decode
            const decoded = new ObjectData(encoded, { version: 1 }).decode(Foo as Decoder<Foo>);
            expect(decoded).toEqual(base);
            expect(decoded.prop).toEqual('');
        });

        test('An empty array is not encoded if it is not nullable', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: new ArrayDecoder(StringDecoder) })
                prop: string[];
            }

            const base = Foo.create({});
            expect(base.prop).toEqual([]);

            // Encode
            const encoded = base.encode({ version: 1 });
            expect(encoded).toEqual({});
            expect(encoded).not.toHaveProperty('prop');

            // Decode
            const decoded = new ObjectData(encoded, { version: 1 }).decode(Foo as Decoder<Foo>);
            expect(decoded).toEqual(base);
            expect(decoded.prop).toEqual([]);
        });

        test('A non empty array is encoded', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: new ArrayDecoder(StringDecoder) })
                prop: string[];
            }

            const base = Foo.create({
                prop: ['test'],
            });

            expect(base.prop).toEqual(['test']);

            // Encode
            const encoded = base.encode({ version: 1 });
            expect(encoded).toEqual({
                prop: ['test'],
            });

            // Decode
            const decoded = new ObjectData(encoded, { version: 1 }).decode(Foo as Decoder<Foo>);
            expect(decoded).toEqual(base);
            expect(decoded.prop).toEqual(['test']);
        });

        test('An empty array is encoded if it is nullable', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: new ArrayDecoder(StringDecoder), nullable: true })
                prop: string[] | null;
            }

            const base = Foo.create({});
            expect(base.prop).toEqual(null);

            // Set to an empty array
            base.prop = [];

            // Encode
            const encoded = base.encode({ version: 1 });
            expect(encoded).toEqual({
                prop: [],
            });

            // Decode
            const decoded = new ObjectData(encoded, { version: 1 }).decode(Foo as Decoder<Foo>);
            expect(decoded).toEqual(base);
            expect(decoded.prop).toEqual([]);
        });

        test('A nullable array that is null, is not encoded', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: new ArrayDecoder(StringDecoder), nullable: true })
                prop: string[] | null;
            }

            const base = Foo.create({});
            expect(base.prop).toEqual(null);

            // Encode
            const encoded = base.encode({ version: 1 });
            expect(encoded).toEqual({});

            // Decode
            const decoded = new ObjectData(encoded, { version: 1 }).decode(Foo as Decoder<Foo>);
            expect(decoded).toEqual(base);
            expect(decoded.prop).toEqual(null);
        });

        test('An optional nullable string is undefined by default', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: StringDecoder, nullable: true, optional: true })
                prop?: string | null;
            }

            const base = Foo.create({});
            expect(base.prop).toEqual(undefined);

            // Check key exists
            expect(base).toHaveProperty('prop');

            // Encode
            const encoded = base.encode({ version: 1 });
            expect(encoded).toEqual({});

            // Decode
            const decoded = new ObjectData(encoded, { version: 1 }).decode(Foo as Decoder<Foo>);
            expect(decoded).toEqual(base);
            expect(decoded.prop).toEqual(undefined);

            // Check key exists
            expect(decoded).toHaveProperty('prop');
        });

        test('An optional nullable string encodes null values', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: StringDecoder, nullable: true, optional: true })
                prop?: string | null;
            }

            const base = Foo.create({
                prop: null,
            });
            expect(base.prop).toEqual(null);

            // Encode
            const encoded = base.encode({ version: 1 });
            expect(encoded).toEqual({
                prop: null,
            });

            // Decode
            const decoded = new ObjectData(encoded, { version: 1 }).decode(Foo as Decoder<Foo>);
            expect(decoded).toEqual(base);
            expect(decoded.prop).toEqual(null);
        });

        test('An optional nullable string encodes empty string values', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: StringDecoder, nullable: true, optional: true })
                prop?: string | null;
            }

            const base = Foo.create({
                prop: '',
            });
            expect(base.prop).toEqual('');

            // Encode
            const encoded = base.encode({ version: 1 });
            expect(encoded).toEqual({
                prop: '',
            });

            // Decode
            const decoded = new ObjectData(encoded, { version: 1 }).decode(Foo as Decoder<Foo>);
            expect(decoded).toEqual(base);
            expect(decoded.prop).toEqual('');
        });

        test('An optional nullable array is undefined by default', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: new ArrayDecoder(StringDecoder), nullable: true, optional: true })
                prop?: string[] | null;
            }

            const base = Foo.create({});
            expect(base.prop).toEqual(undefined);
            // Check key exists
            expect(base).toHaveProperty('prop');

            // Encode
            const encoded = base.encode({ version: 1 });
            expect(encoded).toEqual({});

            // Decode
            const decoded = new ObjectData(encoded, { version: 1 }).decode(Foo as Decoder<Foo>);
            expect(decoded).toEqual(base);
            expect(decoded.prop).toEqual(undefined);
            // Check key exists
            expect(decoded).toHaveProperty('prop');
        });

        test('An optional nullable array encodes null values', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: new ArrayDecoder(StringDecoder), nullable: true, optional: true })
                prop?: string[] | null;
            }

            const base = Foo.create({
                prop: null,
            });
            expect(base.prop).toEqual(null);

            // Encode
            const encoded = base.encode({ version: 1 });
            expect(encoded).toEqual({
                prop: null,
            });

            // Decode
            const decoded = new ObjectData(encoded, { version: 1 }).decode(Foo as Decoder<Foo>);
            expect(decoded).toEqual(base);
            expect(decoded.prop).toEqual(null);
        });

        test('An optional nullable array encodes empty array values', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: new ArrayDecoder(StringDecoder), nullable: true, optional: true })
                prop?: string[] | null;
            }

            const base = Foo.create({
                prop: [],
            });
            expect(base.prop).toEqual([]);

            // Encode
            const encoded = base.encode({ version: 1 });
            expect(encoded).toEqual({
                prop: [],
            });

            // Decode
            const decoded = new ObjectData(encoded, { version: 1 }).decode(Foo as Decoder<Foo>);
            expect(decoded).toEqual(base);
            expect(decoded.prop).toEqual([]);
        });

        test('An empty patchable array is not encoded', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: new ArrayDecoder(StringDecoder) })
                prop: string[];
            }
            const FooPatch = Foo.patchType();

            const base = FooPatch.create({});
            expect(base.prop).toEqual(new PatchableArray());

            // Encode
            const encoded = base.encode({ version: 1 });
            expect(encoded).toEqual({
                _isPatch: true,
            });

            // Decode
            const decoded = new ObjectData(encoded, { version: 1 }).decode(FooPatch as Decoder<AutoEncoderPatchType<Foo>>);
            expect(decoded).toEqual(base);
            expect(decoded.prop).toEqual(new PatchableArray());
        });

        test('A nullable empty patchable array is not encoded', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: new ArrayDecoder(StringDecoder), nullable: true })
                prop: string[] | null;
            }
            const FooPatch = Foo.patchType();

            const base = FooPatch.create({});
            expect(base.prop).toEqual(new PatchableArray());

            // Encode
            const encoded = base.encode({ version: 1 });
            expect(encoded).toEqual({
                _isPatch: true,
            });

            // Decode
            const decoded = new ObjectData(encoded, { version: 1 }).decode(FooPatch as Decoder<AutoEncoderPatchType<Foo>>);
            expect(decoded).toEqual(base);
            expect(decoded.prop).toEqual(new PatchableArray());
        });

        test('A nullable patchable array can be set to null', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: new ArrayDecoder(StringDecoder), nullable: true })
                prop: string[] | null;
            }
            const FooPatch = Foo.patchType();

            const base = FooPatch.create({});
            expect(base.prop).toEqual(new PatchableArray());
            base.prop = null;
            expect(base.prop).toEqual(null);

            // Encode
            const encoded = base.encode({ version: 1 });
            expect(encoded).toEqual({
                _isPatch: true,
                prop: null,
            });

            // Decode
            const decoded = new ObjectData(encoded, { version: 1 }).decode(FooPatch as Decoder<AutoEncoderPatchType<Foo>>);
            expect(decoded).toEqual(base);
            expect(decoded.prop).toEqual(null);
        });

        test('A patchable array can be set to an array', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: new ArrayDecoder(StringDecoder) })
                prop: string[];
            }
            const FooPatch = Foo.patchType();

            const base = FooPatch.create({});
            expect(base.prop).toEqual(new PatchableArray());
            (base.prop as any) = ['test'];
            expect(base.prop).toEqual(['test']);

            // Encode
            const encoded = base.encode({ version: 1 });
            expect(encoded).toEqual({
                _isPatch: true,
                prop: ['test'],
            });

            // Decode
            const decoded = new ObjectData(encoded, { version: 1 }).decode(FooPatch as Decoder<AutoEncoderPatchType<Foo>>);
            expect(decoded).toEqual(base);
            expect(decoded.prop).toEqual(['test']);
        });

        test('A patchable array is encoded', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: new ArrayDecoder(StringDecoder) })
                prop: string[];
            }
            const FooPatch = Foo.patchType();

            const base = FooPatch.create({});
            expect(base.prop).toEqual(new PatchableArray());
            base.prop.addPut('test');

            // Encode
            const encoded = base.encode({ version: 1 });
            expect(encoded).toEqual({
                _isPatch: true,
                prop: {
                    _isPatch: true,
                    changes: [
                        {
                            put: 'test',
                        },
                    ],
                },
            });

            // Decode
            const decoded = new ObjectData(encoded, { version: 1 }).decode(FooPatch as Decoder<AutoEncoderPatchType<Foo>>);
            expect(decoded).toEqual(base);
            const d = new PatchableArray();
            d.addPut('test');
            expect(decoded.prop).toEqual(d);
        });

        test('You cannot decode null for a non-nullable property', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: StringDecoder })
                prop: string;
            }

            expect(() => {
                new ObjectData({
                    prop: null,
                }, { version: 1 }).decode(Foo as Decoder<Foo>);
            }).toThrow('Expected a string at prop');
        });

        test('You cannot decode a number for a string property', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: StringDecoder })
                prop: string;
            }

            expect(() => {
                new ObjectData({
                    prop: 123,
                }, { version: 1 }).decode(Foo as Decoder<Foo>);
            }).toThrow('Expected a string at prop');
        });

        test('You cannot decode a boolean for a string property', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: StringDecoder })
                prop: string;
            }

            expect(() => {
                new ObjectData({
                    prop: false,
                }, { version: 1 }).decode(Foo as Decoder<Foo>);
            }).toThrow('Expected a string at prop');
        });

        test('You cannot decode an array for a string property', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: StringDecoder })
                prop: string;
            }

            expect(() => {
                new ObjectData({
                    prop: [],
                }, { version: 1 }).decode(Foo as Decoder<Foo>);
            }).toThrow('Expected a string at prop');
        });

        test('You cannot decode an object for a string property', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: StringDecoder })
                prop: string;
            }

            expect(() => {
                new ObjectData({
                    prop: {},
                }, { version: 1 }).decode(Foo as Decoder<Foo>);
            }).toThrow('Expected a string at prop');
        });

        test('You can decode undefined for a string property and it will use the default instead', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: StringDecoder })
                prop: string;
            }

            const decoded = new ObjectData({}, { version: 1 }).decode(Foo as Decoder<Foo>);

            expect(decoded).toEqual(Foo.create({ prop: '' }));
        });

        test('You can decode undefined for a string property and it will use the defaultValue instead', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: StringDecoder })
                prop: string = 'Hello world';
            }

            const decoded = new ObjectData({}, { version: 1 }).decode(Foo as Decoder<Foo>);

            expect(decoded).toEqual(Foo.create({ prop: 'Hello world' }));
        });

        test('You can decode undefined for a number property and it will use the defaultValue instead', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: IntegerDecoder })
                prop = 123;
            }

            const decoded = new ObjectData({}, { version: 1 }).decode(Foo as Decoder<Foo>);

            expect(decoded).toEqual(Foo.create({ prop: 123 }));
        });

        test('An id property is not always required, even with default value', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: StringDecoder, defaultValue: () => 'generated' })
                id: string;
            }

            expect(() => {
                new ObjectData({}, { version: 1 }).decode(Foo as Decoder<Foo>);
            }).not.toThrow('Field id is expected');
        });

        test('Id property is optional in pathces', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: StringDecoder, defaultValue: () => 'generated' })
                id: string;
            }

            expect(() => {
                new ObjectData({}, { version: 1 }).decode(Foo.patchType() as Decoder<AutoEncoderPatchType<Foo>>);
            }).not.toThrow('Field id is expected');
        });

        test('An optional id property is not required and defaults to it defaults value', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: StringDecoder, defaultValue: () => 'generated', optional: true })
                id?: string;
            }

            const decoded = new ObjectData({}, { version: 1 }).decode(Foo as Decoder<Foo>);
            expect(decoded.id).toEqual('generated');
        });

        test('An optional id property is not required', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: StringDecoder, optional: true })
                id?: string;
            }

            const decoded = new ObjectData({}, { version: 1 }).decode(Foo as Decoder<Foo>);
            expect(decoded.id).toEqual(undefined);
        });

        test('An optional nullable id property is not required', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: StringDecoder, optional: true, nullable: true })
                id?: string | null;
            }

            const decoded = new ObjectData({}, { version: 1 }).decode(Foo as Decoder<Foo>);
            expect(decoded.id).toEqual(undefined);
        });

        test('You cannot decode undefined for a number property without default value', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: IntegerDecoder })
                prop: number;
            }

            expect(() => {
                new ObjectData({
                    prop: undefined,
                }, { version: 1 }).decode(Foo as Decoder<Foo>);
            }).toThrow('Expected an integer at prop');
        });

        test('Class default values are cleared when creating a patch', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: IntegerDecoder })
                prop = 123;
            }

            const foo = Foo.create({});
            expect(foo.prop).toEqual(123);

            const patch = Foo.patch({});
            expect(patch.prop).toEqual(undefined);
            expect(patch).toHaveProperty('prop');
        });

        test('Field default values are cleared when creating a patch', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: IntegerDecoder, defaultValue: () => 123 })
                prop: number;
            }

            const foo = Foo.create({});
            expect(foo.prop).toEqual(123);

            const patch = Foo.patch({});
            expect(patch.prop).toEqual(undefined);
            expect(patch).toHaveProperty('prop');
        });

        test('You can decode undefined for a nullable property and it will use null instead', () => {
            class Foo extends AutoEncoder {
                @field({ decoder: StringDecoder, nullable: true })
                prop: string | null;
            }

            const decoded = new ObjectData({
                prop: undefined,
            }, { version: 1 }).decode(Foo as Decoder<Foo>);

            expect(decoded).toEqual(Foo.create({ prop: null }));
        });
    });
});
