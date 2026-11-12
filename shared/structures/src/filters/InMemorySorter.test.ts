import { SortItemDirection } from '@stamhoofd/filters/SortList';
import type { InMemorySortDefinitions } from './InMemorySorter.js';
import { compileToInMemorySorter } from './InMemorySorter.js';

describe('in-memory sorter registries', () => {
    const definitions: InMemorySortDefinitions<{ first: number; second: number }> = new Map([
        ['first', { getValue: (object) => object.first, sort: (a, b) => a.first - b.first }],
        ['second', { getValue: (object) => object.second, sort: (a, b) => a.second - b.second }],
    ]);

    it('composes registered sorters in the requested order and direction', () => {
        const sort = compileToInMemorySorter(
            [
                { key: 'first', order: SortItemDirection.ASC },
                { key: 'second', order: SortItemDirection.DESC },
            ],
            definitions,
        );
        expect(
            [
                { first: 2, second: 1 },
                { first: 1, second: 1 },
                { first: 1, second: 2 },
            ].sort(sort),
        ).toEqual([
            { first: 1, second: 2 },
            { first: 1, second: 1 },
            { first: 2, second: 1 },
        ]);
    });

    it('rejects absent keys and empty sort lists', () => {
        for (const key of ['missing', 'constructor', 'toString', '__proto__']) {
            expect(() =>
                compileToInMemorySorter([{ key, order: SortItemDirection.ASC }], definitions),
            ).toThrow('Unknown sort key ' + key);
        }
        expect(() => compileToInMemorySorter([], definitions)).toThrow('No sortBy passed');
    });

    it('accepts explicitly registered special names', () => {
        const special: InMemorySortDefinitions<number> = new Map([
            ['__proto__', { getValue: (value) => value, sort: (a, b) => a - b }],
        ]);
        const sort = compileToInMemorySorter(
            [{ key: '__proto__', order: SortItemDirection.DESC }],
            special,
        );
        expect([1, 3, 2].sort(sort)).toEqual([3, 2, 1]);
    });
});
