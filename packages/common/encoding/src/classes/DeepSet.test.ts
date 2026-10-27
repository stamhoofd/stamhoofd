import { field } from '../decorators/Field.js';
import { deepSet } from '../helpers/deepSet.js';
import { deepSetArray } from '../helpers/deepSetArray.js';
import { deepSetMap } from '../helpers/deepSetMap.js';
import { ArrayDecoder } from '../structs/ArrayDecoder.js';
import DateDecoder from '../structs/DateDecoder.js';
import { EnumDecoder } from '../structs/EnumDecoder.js';
import { MapDecoder } from '../structs/MapDecoder.js';
import StringDecoder from '../structs/StringDecoder.js';
import { AutoEncoder } from './AutoEncoder.js';
import { ObjectData } from './ObjectData.js';
import { isProxy, reactive } from 'vue';

class Dog extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id = '';

    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: new ArrayDecoder(Dog) })
    children: Dog[] = [];
}

class Cat extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id = '';

    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: Cat, nullable: true })
    mother: Cat | null = null;
}

describe('DeepSet', () => {
    it('Reuses references to objects, but updates their data', () => {
        const babyCat = new Cat();
        babyCat.id = '1';
        babyCat.name = 'Baby Cat';

        const cat = new Cat();
        cat.id = '2';
        cat.name = 'Cat';

        babyCat.mother = cat;

        // Do a deep set, where the name of the baby cat and cat has changed

        const babyCatChanged = new Cat();
        babyCatChanged.id = '1';
        babyCatChanged.name = 'Baby Cat 2';

        const catChanged = new Cat();
        catChanged.id = '2';
        catChanged.name = 'Cat 2';

        babyCatChanged.mother = catChanged;

        // Deep set
        babyCat.deepSet(babyCatChanged);

        // Check reference to mother remained equal
        expect(babyCat === babyCatChanged).toBe(false);

        // Reference to mother should be the same
        expect(babyCat.mother === cat).toBe(true);

        // Mother data should be updated
        expect(cat.name).toBe('Cat 2');
        expect(babyCat.name).toBe('Baby Cat 2');
    });

    it('Works recursively in maps with same keys', () => {
        const babyCat = new Cat();
        babyCat.id = '1';
        babyCat.name = 'Baby Cat';

        const cat = new Cat();
        cat.id = '2';
        cat.name = 'Cat';

        babyCat.mother = cat;

        const babyCatChanged = new Cat();
        babyCatChanged.id = '1';
        babyCatChanged.name = 'Baby Cat 2';

        const catChanged = new Cat();
        catChanged.id = '2';
        catChanged.name = 'Cat 2';

        babyCatChanged.mother = catChanged;

        // Deep set
        const map1 = new Map([['a', babyCat]]);
        const map2 = new Map([['a', babyCatChanged]]);
        deepSet(map1, map2);

        // Check reference to mother remained equal
        expect(babyCat === babyCatChanged).toBe(false);

        // Reference to mother should be the same
        expect(babyCat.mother === cat).toBe(true);

        // Mother data should be updated
        expect(cat.name).toBe('Cat 2');
        expect(babyCat.name).toBe('Baby Cat 2');
    });

    it('Does not work recursively in maps with different keys', () => {
        const babyCat = new Cat();
        babyCat.id = '1';
        babyCat.name = 'Baby Cat';

        const cat = new Cat();
        cat.id = '2';
        cat.name = 'Cat';

        babyCat.mother = cat;

        const babyCatChanged = new Cat();
        babyCatChanged.id = '1';
        babyCatChanged.name = 'Baby Cat 2';

        const catChanged = new Cat();
        catChanged.id = '2';
        catChanged.name = 'Cat 2';

        babyCatChanged.mother = catChanged;

        // Deep set
        const map1 = new Map([['a', babyCat]]);
        const map2 = new Map([['b', babyCatChanged]]);
        deepSet(map1, map2);

        expect(map1.size).toEqual(1);
        expect(map1.has('b')).toBe(true);
        expect(map1.has('a')).toBe(false);

        // Mother data should not be updated
        expect(cat.name).toBe('Cat');
        expect(babyCat.name).toBe('Baby Cat');
    });

    it('Reuses references to arrays and updates objects', () => {
        const motherDog = new Dog();
        motherDog.id = '1';
        motherDog.name = 'Mother Dog';

        const originalArray = motherDog.children;

        const dog2 = new Dog();
        dog2.id = '2';
        dog2.name = 'Dog 2';
        motherDog.children.push(dog2);

        const dog3 = new Dog();
        dog3.id = '3';
        dog3.name = 'Dog 3';
        motherDog.children.push(dog3);

        const updatedMotherDog = new Dog();
        updatedMotherDog.id = '1';
        updatedMotherDog.name = 'Mother Dog Updated';

        const updatedDog2 = new Dog();
        updatedDog2.id = '2';
        updatedDog2.name = 'Dog 2 Updated';
        updatedMotherDog.children.push(updatedDog2);

        // Dog 3 is removed

        // New dog 4
        const updatedDog4 = new Dog();
        updatedDog4.id = '4';
        updatedDog4.name = 'Dog 4';
        updatedMotherDog.children.push(updatedDog4);

        // Deep set mother
        motherDog.deepSet(updatedMotherDog);

        // Check reference to array is deep equal
        expect(motherDog.children === originalArray).toBe(true);
        expect(motherDog.children.length).toBe(2);

        // Check dog2 is changed
        expect(motherDog.children[0] === dog2).toBe(true);
        expect(dog2.name).toBe('Dog 2 Updated');

        // Check dog4 is added
        expect(motherDog.children[1] === updatedDog4).toBe(true);
        expect(updatedDog4.name).toBe('Dog 4');
    });

    it('can handle recursive object trees', () => {
        const member1: any = {
            name: 'member one',
            users: [],
        };

        const member2: any = {
            name: 'member two',
            users: [],
        };

        const a: any = {
            id: '1',
            name: 'A',
            members: [
                member1,
                member2,
            ],
        };
        a.friends = [a];
        a.me = a;
        member1.users = [a];
        member2.users = [a];

        const b: any = {
            id: '1',
            name: 'B',
            members: [
                structuredClone(member1),
                structuredClone(member2),
            ],
        };
        b.friends = [b];
        b.me = b;

        b.members[0].users = [b];
        member2.users = [a];

        deepSet(a, b);
        expect(a.name).toEqual('B');
        expect(a.friends[0]).toBe(a);

        deepSet(a, b);
    });

    it('[Regression] copies over the id when called directly', () => {
        const a = { id: 'a', a: true };
        const b = { id: 'b', a: false, addA: true };

        deepSet(a, b);

        expect(a).toStrictEqual({
            id: 'b',
            a: false,
            addA: true,
        });

        // b is unaffected
        expect(b).toStrictEqual({
            id: 'b',
            a: false,
            addA: true,
        });

        expect(a).not.toBe(b);
    });

    it('moves right references', () => {
        const a = { id: 'a', a: true };
        const b = { id: 'b', b: true };
        const c = { id: 'c', c: true };

        const object = {
            id: 'setter',
            a,
            b,
            c,
        };
        const newObject = {
            id: 'setter',
            a: {
                id: 'a', addA: true,
            },
            b: {
                id: 'something else',
                addB: false,
            },
            c: {
                id: 'something else',
                addC: false,
            },
        };
        deepSet(object, newObject);

        // The base-only key `a` is dropped: plain-object dictionaries are synced to object's key set.
        expect(a).toStrictEqual({
            id: 'a',
            addA: true,
        });

        // b and c are unaffected
        expect(b).toStrictEqual({
            id: 'b',
            b: true,
        });
        expect(c).toStrictEqual({
            id: 'c',
            c: true,
        });

        expect(object.b).toBe(newObject.b);
        expect(object.b).toStrictEqual({
            id: 'something else',
            addB: false,
        });
        expect(object.c).toBe(newObject.c);
        expect(object.c).toStrictEqual({
            id: 'something else',
            addC: false,
        });
    });

    it('copies inherited properties', () => {
        let count = 0;
        class Animal {
            id: string;
            type: string;
            count: number;

            constructor(id: string, type: string) {
                this.id = id;
                this.type = type;
                this.count = (count++);
            }
        }

        class Dog extends Animal {
            name: string;

            constructor(id: string, type: string, name: string) {
                super(id, type);
                this.name = name;
            }
        }

        const a = new Dog('a', 'german shepherd', 'Pablo');
        const b = new Dog('b', 'golden retriever', 'Luc');
        expect(a.count).toEqual(0);
        expect(b.count).toEqual(1);

        deepSet(a, b);

        const d = new Dog('b', 'golden retriever', 'Luc');
        d.count = 1;
        expect(a).toStrictEqual(d);
    });

    it('ignores methods', () => {
        let count = 0;
        const a = { id: 'a', a: true, counter() {
            return count++;
        } };
        const og = a.counter;
        const b = { id: 'a', b: true, counter() {
            count++; // simulate access to the method
            return -100;
        } };

        deepSet(a, b);

        // The base-only key `a` is dropped; `counter` stays the original method (methods are ignored).
        expect(a).toStrictEqual({
            id: 'a',
            b: true,
            counter: og,
        });

        expect(a.counter()).toEqual(0);
        expect(a.counter()).toEqual(1);

        // Not changed
        expect(b.counter()).toEqual(-100);
    });

    it('ignores getters', () => {
        let count = 0;
        const a = { id: 'a', a: true, get counter() {
            return count++;
        } };
        const b = { id: 'a', b: true, get counter() {
            count++;
            return -100;
        } };

        deepSet(a, b);

        // The base-only key `a` is dropped; `counter` stays the original getter (getters are ignored).
        expect(a).toStrictEqual({
            id: 'a',
            b: true,
            counter: 0, // First access by vitest itself
        });

        expect(a.counter).toEqual(1);
        expect(a.counter).toEqual(2);
    });

    it('ignores getter setters', () => {
        let count = 0;
        const a = { id: 'a', a: true, get counter() {
            return count++;
        }, set counter(v: number) {
            // noop
        } };
        const b = { id: 'a', b: true, get counter() {
            count++;
            return -100;
        }, set counter(v: number) {
            // noop
        } };

        deepSet(a, b);

        // The base-only key `a` is dropped; `counter` stays the original getter (getters are ignored).
        expect(a).toStrictEqual({
            id: 'a',
            b: true,
            counter: 0, // First access by vitest itself
        });

        expect(a.counter).toEqual(1);
        expect(a.counter).toEqual(2);
    });

    it('setting on a child class', () => {
        class Base extends AutoEncoder {
            @field({ decoder: StringDecoder })
            id!: string;

            @field({ decoder: StringDecoder })
            name!: string;
        }

        class Friend extends Base {
        }

        class Extended extends Base {
            @field({ decoder: new ArrayDecoder(Friend) })
            friends!: Friend[];

            get myFriends() {
                return this.friends;
            }
        }

        const base = Base.create({
            id: 'tmp',
            name: 'Temporary',
        });

        const receivedFromBackend = Extended.create({
            id: 'a',
            name: 'A',
            friends: [
                Friend.create({
                    id: 'friend',
                    name: 'My Friend',
                }),
            ],
        });

        base.deepSet(receivedFromBackend);

        expect(base).toEqual(Extended.create({
            id: 'a',
            name: 'A',
            friends: [
                Friend.create({
                    id: 'friend',
                    name: 'My Friend',
                }),
            ],
        }));
        expect(base).toBeInstanceOf(Base);
        expect(base).not.toBeInstanceOf(Extended);
        expect('myFriends' in base).toBe(false);

        expect((base as any).friends).toBe(receivedFromBackend.friends);

        // Received another new version from the backend
        const receivedFromBackendNew = Extended.create({
            id: 'a',
            name: 'Changed',
            friends: [
                Friend.create({
                    id: 'friend',
                    name: 'My Friend',
                }),
                Friend.create({
                    id: 'friend2',
                    name: 'My Friend 2',
                }),
            ],
        });

        receivedFromBackend.deepSet(receivedFromBackendNew);

        expect(base).toEqual(Extended.create({
            id: 'a',
            name: 'A',
            friends: [
                // Only this reference has changed
                Friend.create({
                    id: 'friend',
                    name: 'My Friend',
                }),
                Friend.create({
                    id: 'friend2',
                    name: 'My Friend 2',
                }),
            ],
        }));

        expect(receivedFromBackend).toEqual(Extended.create({
            id: 'a',
            name: 'Changed',
            friends: [
                // Only this reference has changed
                Friend.create({
                    id: 'friend',
                    name: 'My Friend',
                }),
                Friend.create({
                    id: 'friend2',
                    name: 'My Friend 2',
                }),
            ],
        }));

        // Check all references are in harmony
        expect((base as any).friends).toBe(receivedFromBackend.friends);
        expect(receivedFromBackend.friends).toBe(receivedFromBackendNew.friends);

        base.deepSet(receivedFromBackendNew);

        expect(base).toEqual(Extended.create({
            id: 'a',
            name: 'Changed',
            friends: [
                // Only this reference has changed
                Friend.create({
                    id: 'friend',
                    name: 'My Friend',
                }),
                Friend.create({
                    id: 'friend2',
                    name: 'My Friend 2',
                }),
            ],
        }));

        expect(receivedFromBackend).toEqual(Extended.create({
            id: 'a',
            name: 'Changed',
            friends: [
                // Only this reference has changed
                Friend.create({
                    id: 'friend',
                    name: 'My Friend',
                }),
                Friend.create({
                    id: 'friend2',
                    name: 'My Friend 2',
                }),
            ],
        }));
    });

    describe('Plain-object dictionaries (e.g. filters)', () => {
        it('[Regression] drops stale keys when a filter is simplified to a bare condition', () => {
            // A filter simplified from a two-condition $and to a bare single condition: the $and
            // wrapper is dropped, so the new value shares no keys with the cached one.
            const container: any = {
                filter: { $and: [{ age: { $gt: 18 } }, { gender: { $eq: 'male' } }] },
            };
            const originalFilter = container.filter;

            deepSet(container, { filter: { age: { $gt: 18 } } });

            // The stale $and wrapper must not survive the merge.
            expect(container.filter).toStrictEqual({ age: { $gt: 18 } });
            // The base reference is reused (updated in place).
            expect(container.filter).toBe(originalFilter);
        });

        it('[Regression] drops stale keys even when the dictionaries still share a key', () => {
            const container: any = {
                filter: { $or: [{ age: { $gt: 18 } }], age: { $gt: 18 } },
            };
            const originalFilter = container.filter;

            deepSet(container, { filter: { $or: [{ age: { $gt: 21 } }] } });

            // `age` only existed on base and must be removed, even though `$or` is shared.
            expect(container.filter).toStrictEqual({ $or: [{ age: { $gt: 21 } }] });
            expect(container.filter).toBe(originalFilter);
        });

        it('keeps updating shared keys in place', () => {
            const container: any = {
                filter: { $and: [{ age: { $gt: 18 } }, { gender: { $eq: 'male' } }] },
            };
            const originalAnd = container.filter.$and;

            deepSet(container, { filter: { $and: [{ age: { $gt: 21 } }] } });

            expect(container.filter).toStrictEqual({ $and: [{ age: { $gt: 21 } }] });
            // Same top-level key ($and) -> array reference is reused and updated in place.
            expect(container.filter.$and).toBe(originalAnd);
        });
    });

    describe('Arrays', () => {
        it('New items are added and existing altered', () => {
            const existingItem = { id: 'A', name: 'A' };
            const container = {
                name: 'Container',
                friends: {
                    organizations: [existingItem],
                },
            };
            const originalArray = container.friends.organizations;

            const newItem = { id: 'B', name: 'B' };
            const containerAfter = {
                name: 'Container',
                friends: {
                    organizations: [{ id: 'A', name: 'A Changed' }, newItem],
                },
            };

            const result = deepSet(container, containerAfter);
            expect(result).toBe(container);

            expect(container.friends.organizations.length).toEqual(2);
            expect(container.friends.organizations[0]).toBe(existingItem);
            expect(container.friends.organizations[1]).toBe(newItem);

            expect(existingItem.name).toEqual('A Changed');

            // Array refrence should be reused
            expect(container.friends.organizations).toBe(originalArray);
        });

        it('Missing items are removed by default while existing are still altered', () => {
            const existingItem = { id: 'A', name: 'A' };
            const newItem = { id: 'B', name: 'B' };
            const container = {
                name: 'Container',
                friends: {
                    organizations: [existingItem, newItem],
                },
            };
            const originalArray = container.friends.organizations;

            const containerAfter = {
                name: 'Container',
                friends: {
                    organizations: [{ id: 'A', name: 'A Changed' }],
                },
            };

            const result = deepSet(container, containerAfter);
            expect(result).toBe(container);

            expect(container.friends.organizations.length).toEqual(1);
            expect(container.friends.organizations[0]).toBe(existingItem);

            expect(existingItem.name).toEqual('A Changed');

            // Array refrence should be reused
            expect(container.friends.organizations).toBe(originalArray);
        });
    });

    describe('Vue Proxies', () => {
        enum STPackageType {
            // Members without activities (not available in frontend anymore)
            LegacyMembers = 'LegacyMembers',

            // Full members package
            Members = 'Members',

            // Webshop package (max 10 webshops)
            Webshops = 'Webshops',

            // One webshop package (max 1 webshop)
            SingleWebshop = 'SingleWebshop',

            TrialMembers = 'TrialMembers',
            TrialWebshops = 'TrialWebshops',
        }

        class STPackageStatus extends AutoEncoder {
            @field({ decoder: DateDecoder })
            startDate!: Date;

            @field({ decoder: DateDecoder, nullable: true })
            validUntil: Date | null = null;
        }

        test('Proxy maps different underlying value', () => {
            const mapA = reactive(new Map<STPackageType, STPackageStatus>([
                [STPackageType.TrialMembers, STPackageStatus.create({
                    startDate: new Date(1_000),
                })],
            ]));
            const mapB = new Map<STPackageType, STPackageStatus>([
                [STPackageType.TrialMembers, STPackageStatus.create({
                    startDate: new Date(1_000),
                })],
            ]);

            const result = deepSetMap(mapA, mapB);
            expect(result.size).toEqual(1);
        });

        test('[Regression] Proxy maps', () => {
            const m = new Map<STPackageType, STPackageStatus>([
                [STPackageType.TrialMembers, STPackageStatus.create({
                    startDate: new Date(1_000),
                })],
            ]);
            const mapA = reactive(m);
            const mapB = m;

            const result = deepSetMap(mapA, mapB);
            expect(result.size).toEqual(1);
        });

        test('[Regression] Proxy arrays', () => {
            const m = [
                STPackageStatus.create({
                    startDate: new Date(1_000),
                }),
            ];
            const arrayA = reactive(m);
            const arrayB = m;

            const result = deepSetArray(arrayA, arrayB);
            expect(result.length).toEqual(1);
        });
    });
});
