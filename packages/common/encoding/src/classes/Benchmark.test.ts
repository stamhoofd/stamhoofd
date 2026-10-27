import { v4 as uuidv4 } from 'uuid';
import { field } from '../decorators/Field.js';
import { ArrayDecoder } from '../structs/ArrayDecoder.js';
import BooleanDecoder from '../structs/BooleanDecoder.js';
import IntegerDecoder from '../structs/IntegerDecoder.js';
import { MapDecoder } from '../structs/MapDecoder.js';
import StringDecoder from '../structs/StringDecoder.js';
import { AutoEncoder } from './AutoEncoder.js';
AutoEncoder.skipDefaultValuesVersion = 0;

class Dog extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name: string;

    @field({ decoder: IntegerDecoder })
    age: number;

    @field({ decoder: BooleanDecoder })
    isAdmin: boolean = false;

    @field({ decoder: new ArrayDecoder(Dog) })
    friends: Dog[];

    @field({ decoder: new MapDecoder(StringDecoder, Dog) })
    others: Map<string, Dog>;
}
function init() {
    const obj = Dog.create({
        name: 'Simon',
        age: 16,
        isAdmin: false,
        friends: [
            Dog.create({
                name: 'friend A',
                age: 16,
            }),
            Dog.create({
                name: 'friend B',
                age: 16,
            }),
            Dog.create({
                name: 'friend C',
                age: 16,
            }),
        ],
        others: new Map([
            ['hello', Dog.create({
                name: 'friend A',
                age: 16,
                friends: [
                    Dog.create({
                        name: 'friend A',
                        age: 16,
                    }),
                    Dog.create({
                        name: 'friend B',
                        age: 16,
                    }),
                    Dog.create({
                        name: 'friend C',
                        age: 16,
                    }),
                ],
            })],
            ['world', Dog.create({
                name: 'friend Q',
                age: 0,
                friends: [
                    Dog.create({
                        name: 'friend A',
                        age: 16,
                    }),
                    Dog.create({
                        name: 'friend B',
                        age: 16,
                    }),
                    Dog.create({
                        name: 'friend C',
                        age: 16,
                    }),
                ],
            })],
        ]),
    });
    return obj;
}

function initHuge(depth = 0) {
    const obj = Dog.create({
        name: 'Simon',
        age: 16,
        isAdmin: false,
        friends: depth < 2 ? new Array(100).fill(0).map(() => initHuge(depth + 1)) : [],
        others: new Map([
            ['hello', Dog.create({
                name: 'friend A',
                age: 16,
                friends: depth < 2 ? new Array(100).fill(0).map(() => initHuge(depth + 1)) : [],
            })],
            ['world', Dog.create({
                name: 'friend Q',
                age: 0,
                friends: depth < 2 ? new Array(100).fill(0).map(() => initHuge(depth + 1)) : [],
            })],
        ]),
    });
    return obj;
}

function sample(callback: () => void, maximum = 30_000) {
    const startTime = process.hrtime.bigint();

    let total = BigInt(0);
    let iterations = BigInt(0);
    while (true) {
        const begin = process.hrtime.bigint();
        callback();
        const elapsed = process.hrtime.bigint() - begin;
        total += elapsed;
        iterations += BigInt(1);
        const totalElapsed = process.hrtime.bigint() - startTime;
        if (totalElapsed > maximum * 1000 * 1000) {
            const avg = (total / iterations);
            return Math.round(Number(avg));
        }
    }
}

describe.skip('Benchmark', () => {
    test('Encoding small object', () => {
        const obj = init();
        const avg = sample(() => obj.encode({ version: 10 }));

        console.log('Encode small', avg + 'us');
    }, 120_000);

    test('Encoding huge object', () => {
        const obj = initHuge();

        const avg = sample(() => obj.encode({ version: 10 }));

        console.log('Encode huge', avg + 'us');
    }, 120_000);

    test('Decoding small object', () => {
        const obj = init();
        const encoded = JSON.stringify(obj.encode({ version: 10 }));
        const parsed = JSON.parse(encoded);

        const avg = sample(() => Dog.decodeField(parsed, { version: 10 }));

        console.log('Decode small', avg + 'us');
    });

    test('Decoding huge object', () => {
        const obj = initHuge();
        const encoded = JSON.stringify(obj.encode({ version: 10 }));
        const parsed = JSON.parse(encoded);

        const avg = sample(() => Dog.decodeField(parsed, { version: 10 }));

        console.log('Decode huge', avg + 'us');
    });

    test('Patching small object', () => {
        const obj = init();
        const runCount = 50_000;
        const startTime = process.hrtime.bigint();

        for (let i = 0; i < runCount; i += 1) {
            obj.patch({ age: i, name: 'name' + i });
        }

        const elapsedTime = process.hrtime.bigint() - startTime;

        // Convert to microseconds
        const elapsedTimeMs = Number(elapsedTime) / 1000 / 1000;

        console.log('Patching small', elapsedTimeMs);

        expect(elapsedTimeMs).toBeLessThan(1_000);
    });
});
