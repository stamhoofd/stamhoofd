import { field } from '../decorators/Field.js';
import { ArrayDecoder } from '../structs/ArrayDecoder.js';
import IntegerDecoder from '../structs/IntegerDecoder.js';
import { MapDecoder } from '../structs/MapDecoder.js';
import { PatchableArray } from '../structs/PatchableArray.js';
import StringDecoder from '../structs/StringDecoder.js';
import { AutoEncoder } from './AutoEncoder.js';
import { PatchMap, PatchableArrayAutoEncoder } from './Patchable.js';

class Dog extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id = '';

    @field({ decoder: StringDecoder })
    name: string = '';

    @field({ decoder: Dog, nullable: true })
    friend: Dog | null = null;
}

class House extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id = '';

    @field({ decoder: new MapDecoder(StringDecoder, Dog) })
    dogs: Map<string, Dog> = new Map();
}

class SafeHouse extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id = '';

    @field({ decoder: new ArrayDecoder(Dog) })
    dogs: Dog[] = [];
}

const STExpect = {
    errorWithCode: (code: string) => expect.objectContaining({ code }) as jest.Constructable,
    errorWithMessage: (message: string) => expect.objectContaining({ message }) as jest.Constructable,
    simpleError: (data: {
        code?: string;
        message?: string | RegExp;
        field?: string;
    }) => {
        const d = {
            code: data.code ?? expect.any(String),
            message: data.message ? expect.stringMatching(data.message) : expect.any(String),
            field: data.field ?? expect.anything(),
        };

        if (!data.field) {
            delete d.field;
        }
        return expect.objectContaining(d) as jest.Constructable;
    },
    simpleErrors: (data: {
        code?: string;
        message?: string | RegExp;
        field?: string;
    }[]) => {
        return expect.objectContaining({
            errors: data.map(d => STExpect.simpleError(d)),
        }) as jest.Constructable;
    },
};

describe('Patchable', () => {
    test('Patching null is not allowed if no default value', () => {
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
    });

    test('Patching null is allowed if there is a default value', () => {
        class Friend extends AutoEncoder {
            @field({ decoder: StringDecoder })
            name: string;

            @field({ decoder: IntegerDecoder, defaultValue: () => 18 })
            age: number;
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

        // Patching the name of the friend would throw an error
        const result = myDog.patch({
            friend: Friend.patch({
                name: 'Buddy',
            }),
        });
        expect(result.friend).not.toBeNull();
        expect(result.friend?.name).toBe('Buddy');
        expect(result.friend?.age).toBe(18);
    });

    test('Patching a patch should not use default values', () => {
        class Friend extends AutoEncoder {
            @field({ decoder: IntegerDecoder })
            age = 0;

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

        const myDog = Dog.patch({
            name: 'Fido',
        });

        // Patching the name of the friend would throw an error
        const result = myDog.patch({
            friend: Friend.patch({
                name: 'Buddy',
            }),
        });
        expect(result.friend?.isPatch()).toEqual(true);
        expect(result.friend!.age).toBeUndefined();
        expect(result.friend).not.toBeNull();
        expect(result.friend?.name).toBe('Buddy');
    });

    test('Patching an identifyable patch should not use default values', () => {
        class Dog extends AutoEncoder {
            @field({ decoder: StringDecoder })
            id = '';

            @field({ decoder: StringDecoder })
            name: string = '';

            @field({ decoder: Dog, nullable: true })
            friend: Dog | null = null;
        }

        const myDog = Dog.patch({
            name: 'Fido',
        });

        // Patching the name of the friend would throw an error
        const result = myDog.patch({
            friend: Dog.patch({
                name: 'Buddy',
            }),
        });
        expect(result.friend?.isPatch()).toEqual(true);
        expect(result.friend).not.toBeNull();
        expect(result.friend?.name).toBe('Buddy');
        expect(result.friend?.id).toBeUndefined();
    });

    test('[Regression] Patching an object with a nullable array should keep it unaffected', () => {
        class Dog extends AutoEncoder {
            @field({ decoder: StringDecoder })
            id = '';

            @field({ decoder: StringDecoder })
            name: string = '';

            @field({ decoder: new ArrayDecoder(StringDecoder), nullable: true })
            friendIds: string[] | null = null;
        }

        const myDog = Dog.create({
            name: 'Fido',
        });

        expect(myDog.friendIds).toEqual(null);

        const p = Dog.patch({
            name: 'Frido',
        });
        const updated = myDog.patch(p);

        expect(updated.friendIds).toEqual(null);
    });

    test('Patching a patch with patchable array should keep patchable array and not transform into array', () => {
        class Dog extends AutoEncoder {
            @field({ decoder: StringDecoder })
            id = '';

            @field({ decoder: StringDecoder })
            name: string = '';

            @field({ decoder: new ArrayDecoder(Dog), nullable: true })
            friends: Dog[] | null = null;
        }

        const myDog = Dog.patch({
            name: 'Fido',
        });

        const arr = new PatchableArray() as PatchableArrayAutoEncoder<Dog>;
        arr.addPut(Dog.create({
            id: 'fr',
            name: 'Friend',
        }));

        // Patching the name of the friend would throw an error
        const result = myDog.patch({
            friends: arr,
        });

        expect(result.friends).toBeInstanceOf(PatchableArray);
        expect(result.friends?.changes).toHaveLength(1);
    });

    test('Patching a patch with patchable map should keep patchable map and not transform into map', () => {
        class Dog extends AutoEncoder {
            @field({ decoder: StringDecoder })
            id = '';

            @field({ decoder: StringDecoder })
            name: string = '';

            @field({ decoder: new MapDecoder(StringDecoder, Dog), nullable: true })
            friends: Map<string, Dog> | null = new Map();
        }

        const myDog = Dog.patch({
            name: 'Fido',
        });

        const arr = new PatchMap<string, Dog>();
        arr.set('fr', Dog.create({
            id: 'fr',
            name: 'Friend',
            friends: null,
        }));

        // Patching the name of the friend would throw an error
        const result = myDog.patch({
            friends: arr,
        });

        expect(result.friends).toBeInstanceOf(PatchMap);
        expect(result.friends?.size).toEqual(1);
    });

    test('Patching null is allowed if there is a default value via the Field decorator', () => {
        class Friend extends AutoEncoder {
            @field({ decoder: StringDecoder })
            id = '';

            @field({ decoder: StringDecoder })
            name: string = '';
        }

        class Dog extends AutoEncoder {
            @field({ decoder: StringDecoder })
            id = '';

            @field({ decoder: StringDecoder })
            name: string = '';

            @field({ decoder: Friend, nullable: true })
            friend: Friend | null = Friend.create({ id: 'default', name: 'Default' });
        }

        const myDog = Dog.create({
            id: 'dog1',
            name: 'Fido',
            friend: null,
        });

        // Patching the name of the friend would throw an error
        const result = myDog.patch(Dog.patch({
            friend: Dog.patch({
                name: 'Buddy',
            }),
        }));

        // Results in adding a new friend

        expect(result.friend).not.toBeNull();
        expect(result.friend?.name).toBe('Buddy');
    });

    test('Patching an object is allowed', () => {
        const myDog = Dog.create({
            id: 'dog1',
            name: 'Fido',
            friend: Dog.create({
                id: 'dog2',
                name: 'Rex',
            }),
        });

        // Patching the name of the friend would throw an error
        expect(() => {
            myDog.patch(Dog.patch({
                friend: Dog.patch({
                    name: 'Buddy',
                }),
            }));
        }).not.toThrow();
    });

    describe('Maps', () => {
        test('Patching a map with missing property is not allowed', () => {
            const house = House.create({
                id: 'house1',
            });

            // Patching the name of the friend would throw an error
            expect(() => {
                const patch = House.patch({});
                patch.dogs.set('dog1', Dog.patch({
                    name: 'Fido',
                }));
                house.patch(patch);
            }).toThrow(STExpect.simpleError({
                code: 'cannot_patch_null',
            }));
        });

        test('Patching a map with missing property is allowed when it can be defaulted', () => {
            class Key extends AutoEncoder {
                @field({ decoder: StringDecoder })
                name: string = '';
            }

            class Keychain extends AutoEncoder {
                @field({ decoder: StringDecoder })
                id = '';

                @field({ decoder: new MapDecoder(StringDecoder, Key) })
                keys: Map<string, Key> = new Map();
            }

            const keychain = Keychain.create({
                id: 'house1',
            });

            // Patching the name of the friend would throw an error
            const patch = Keychain.patch({});
            patch.keys.set('key1', Key.patch({
                name: 'Just a key',
            }));
            const result = keychain.patch(patch);
            expect(result.keys.get('key1')?.name).toBe('Just a key');
        });

        test('Patching a map with missing property is allowed when it can be defaulted using the decoder getDefaultValue', () => {
            class Key extends AutoEncoder {
                @field({ decoder: StringDecoder })
                name: string; // defaults to '' because of StringDecoder
            }

            class Keychain extends AutoEncoder {
                @field({ decoder: StringDecoder })
                id = '';

                @field({ decoder: new MapDecoder(StringDecoder, Key) })
                keys: Map<string, Key> = new Map();
            }

            const keychain = Keychain.create({
                id: 'house1',
            });

            // Patching the name of the friend would throw an error
            const patch = Keychain.patch({});
            patch.keys.set('key1', Key.patch({
                name: 'Just a key',
            }));
            const result = keychain.patch(patch);
            expect(result.keys.get('key1')?.name).toBe('Just a key');
        });

        test('Patching a map with missing property is not allowed when it cannot be defaulted', () => {
            class Key extends AutoEncoder {
                @field({ decoder: IntegerDecoder })
                num: number; // note there is no default value here
            }

            class Keychain extends AutoEncoder {
                @field({ decoder: StringDecoder })
                id = '';

                @field({ decoder: new MapDecoder(StringDecoder, Key) })
                keys: Map<string, Key> = new Map();
            }

            const keychain = Keychain.create({
                id: 'house1',
            });

            expect(() => {
                // Patching the name of the friend would throw an error
                const patch = Keychain.patch({});
                patch.keys.set('key1', Key.patch({
                    num: 5,
                }));
                keychain.patch(patch);
            }).toThrow(STExpect.simpleError({
                code: 'cannot_patch_null',
            }));
        });

        test('Patching a map with put property is allowed', () => {
            const house = House.create({
                id: 'house1',
            });

            // Patching the name of the friend would throw an error
            let result!: House;
            expect(() => {
                const patch = House.patch({});
                patch.dogs.set('dog1', Dog.create({
                    id: 'dog1',
                    name: 'Fido',
                }));
                result = house.patch(patch);
            }).not.toThrow();
            expect(result.dogs.get('dog1')?.name).toBe('Fido');
        });

        test('Deleting a non existing property of a map is allowed', () => {
            const house = House.create({
                id: 'house1',
            });

            // Patching the name of the friend would throw an error
            expect(() => {
                const patch = House.patch({});
                patch.dogs.set('dog1', null);
                house.patch(patch);
            }).not.toThrow();
        });

        test('Deleting an existing property of a map is allowed', () => {
            const house = House.create({
                id: 'house1',
            });

            house.dogs.set('dog1', Dog.create({
                id: 'dog1',
                name: 'Rex',
            }));

            let result!: House;

            // Patching the name of the friend would throw an error
            expect(() => {
                const patch = House.patch({});
                patch.dogs.set('dog1', null);
                result = house.patch(patch);
            }).not.toThrow();

            expect(result.dogs.has('dog1')).toBe(false);
        });

        test('Patching a map with existing property is allowed', () => {
            const house = House.create({
                id: 'house1',
            });

            house.dogs.set('dog1', Dog.create({
                id: 'dog1',
                name: 'Rex',
            }));

            let result!: House;

            // Patching the name of the friend would throw an error
            expect(() => {
                const patch = House.patch({});
                patch.dogs.set('dog1', Dog.patch({
                    name: 'Fido',
                }));
                result = house.patch(patch);
            }).not.toThrow();

            expect(result.dogs.get('dog1')?.name).toBe('Fido');
        });
    });

    describe('Arrays', () => {
        test('Patching an array with missing item is a noop', () => {
            const house = SafeHouse.create({
                id: 'house1',
            });

            // Patch an item that does not exist
            let result!: SafeHouse;
            expect(() => {
                const patch = SafeHouse.patch({});
                patch.dogs.addPatch(Dog.patch({
                    name: 'Fido',
                }));
                result = house.patch(patch);
            }).not.toThrow();

            expect(result.dogs.length).toBe(0);
        });

        test('Putting an item in an array that already exists should replace instead of append', () => {
            const house = SafeHouse.create({
                id: 'house1',
                dogs: [
                    Dog.create({
                        id: 'dog2',
                        name: 'Rex',
                    }),
                    Dog.create({
                        id: 'dog1',
                        name: 'Rex',
                    }),
                    Dog.create({
                        id: 'dog3',
                        name: 'Rex',
                    }),
                ],
            });

            // Patch an item that does not exist
            let result!: SafeHouse;
            expect(() => {
                const patch = SafeHouse.patch({});
                patch.dogs.addPut(Dog.create({
                    id: 'dog1',
                    name: 'Fido',
                }));
                result = house.patch(patch);
            }).not.toThrow();

            expect(result.dogs.length).toBe(3);
            expect(result.dogs[2].name).toBe('Fido');

            // Check order has changed
            expect(result.dogs.map(d => d.id)).toEqual(['dog2', 'dog3', 'dog1']);
        });

        test('Putting an item at the start in an array that already exists should replace instead', () => {
            const house = SafeHouse.create({
                id: 'house1',
                dogs: [
                    Dog.create({
                        id: 'dog2',
                        name: 'Rex',
                    }),
                    Dog.create({
                        id: 'dog1',
                        name: 'Rex',
                    }),
                    Dog.create({
                        id: 'dog3',
                        name: 'Rex',
                    }),
                ],
            });

            // Patch an item that does not exist
            let result!: SafeHouse;
            expect(() => {
                const patch = SafeHouse.patch({});
                patch.dogs.addPut(Dog.create({
                    id: 'dog1',
                    name: 'Fido',
                }), null);
                result = house.patch(patch);
            }).not.toThrow();

            expect(result.dogs.length).toBe(3);
            expect(result.dogs[0].name).toBe('Fido');

            // Check order has changed
            expect(result.dogs.map(d => d.id)).toEqual(['dog1', 'dog2', 'dog3']);
        });

        test('Putting an item after id in an array that already exists should replace instead', () => {
            const house = SafeHouse.create({
                id: 'house1',
                dogs: [
                    Dog.create({
                        id: 'dog2',
                        name: 'Rex',
                    }),
                    Dog.create({
                        id: 'dog1',
                        name: 'Rex',
                    }),
                    Dog.create({
                        id: 'dog3',
                        name: 'Rex',
                    }),
                ],
            });

            // Patch an item that does not exist
            let result!: SafeHouse;
            expect(() => {
                const patch = SafeHouse.patch({});
                patch.dogs.addPut(Dog.create({
                    id: 'dog1',
                    name: 'Fido',
                }), 'dog2');
                result = house.patch(patch);
            }).not.toThrow();

            expect(result.dogs.length).toBe(3);
            expect(result.dogs[1].name).toBe('Fido');

            // Check order has changed
            expect(result.dogs.map(d => d.id)).toEqual(['dog2', 'dog1', 'dog3']);
        });
    });
});
