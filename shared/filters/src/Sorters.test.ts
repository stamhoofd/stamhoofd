import { SortItemDirection } from './SortList.js';
import type { SortDefinitions } from './Sorters.js';
import { getSortFilter } from './Sorters.js';

describe('sorter registries', () => {
    const definitions: SortDefinitions<{ id: string; value?: number }> = new Map([
        ['id', { getValue: object => object.id }],
        ['value', { getValue: object => object.value }],
    ]);

    it('builds cursor filters with direction and tie-breakers', () => {
        expect(getSortFilter({ id: 'last', value: 5 }, definitions, [
            { key: 'value', order: SortItemDirection.DESC },
            { key: 'id', order: SortItemDirection.ASC },
        ])).toEqual({
            $or: [
                { value: { $lt: 5 } },
                { $and: [{ value: 5 }, { id: { $gt: 'last' } }] },
            ],
        });
    });

    it('keeps an undefined extracted value distinct from an unknown sorter', () => {
        expect(getSortFilter({ id: 'last' }, definitions, [{ key: 'value', order: SortItemDirection.ASC }]))
            .toEqual({ value: { $gt: undefined } });
    });

    it('rejects unregistered keys that match Object.prototype names', () => {
        for (const key of ['constructor', 'toString', '__proto__']) {
            expect(() => getSortFilter({ id: 'last' }, definitions, [{ key, order: SortItemDirection.ASC }]))
                .toThrow('Unknown sort key ' + key);
        }
    });

    it('accepts explicitly registered special names', () => {
        const special: SortDefinitions<string> = new Map([['__proto__', { getValue: value => value }]]);
        expect(getSortFilter('last', special, [{ key: '__proto__', order: SortItemDirection.DESC }]))
            .toEqual({ ['__proto__']: { $lt: 'last' } });
    });
});
