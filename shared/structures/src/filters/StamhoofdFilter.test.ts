import type { StamhoofdFilter, WrapperFilter } from './StamhoofdFilter.js';
import { FilterWrapperMarker, unwrapFilterRecursively } from './StamhoofdFilter.js';

describe('unwrapFilterRecursively', () => {
    const wrap: WrapperFilter = { groupId: FilterWrapperMarker };
    const nestedWrap: WrapperFilter = { registrations: { $elemMatch: { groupId: FilterWrapperMarker } } };

    describe('Matches conjunctions', () => {
        test('Matches the root object', () => {
            expect(unwrapFilterRecursively({ groupId: 'a' }, wrap)).toStrictEqual({ match: true, markerValue: 'a', leftOver: undefined });
        });

        test('Keeps leftover keys of the root object', () => {
            const result = unwrapFilterRecursively({ groupId: 'a', firstName: 'John' }, wrap);
            expect(result.match).toBe(true);
            expect(result.markerValue).toBe('a');
            expect(result.leftOver).toEqual({ firstName: 'John' });
        });

        test('Matches an item of a top-level array', () => {
            const result = unwrapFilterRecursively([{ firstName: 'John' }, { groupId: 'a' }], wrap);
            expect(result.match).toBe(true);
            expect(result.markerValue).toBe('a');
        });

        test('Matches an item of an $and array', () => {
            const result = unwrapFilterRecursively({ $and: [{ firstName: 'John' }, { groupId: 'a' }] }, wrap);
            expect(result.match).toBe(true);
            expect(result.markerValue).toBe('a');
        });

        test('Matches an $and nested in an array nested in an $and', () => {
            const result = unwrapFilterRecursively({ $and: [[{ $and: [{ groupId: { $in: ['a', 'b'] } }] }]] }, wrap);
            expect(result.match).toBe(true);
            expect(result.markerValue).toEqual({ $in: ['a', 'b'] });
        });

        test('Matches the $and key even when other keys are present at the root', () => {
            const result = unwrapFilterRecursively({ $or: [{ firstName: 'John' }], $and: [{ groupId: 'a' }] }, wrap);
            expect(result.match).toBe(true);
            expect(result.markerValue).toBe('a');
        });

        test('Returns the first matching item', () => {
            const result = unwrapFilterRecursively([{ groupId: 'a' }, { groupId: 'b' }], wrap);
            expect(result.match).toBe(true);
            expect(result.markerValue).toBe('a');
        });

        test('Matches a nested wrapper', () => {
            const result = unwrapFilterRecursively([{ registrations: { $elemMatch: { groupId: 'a' } } }], nestedWrap);
            expect(result.match).toBe(true);
            expect(result.markerValue).toBe('a');
        });
    });

    describe('Does not match anything that is not a conjunction', () => {
        const noMatch = (filter: StamhoofdFilter, w: WrapperFilter = wrap) => {
            expect(unwrapFilterRecursively(filter, w)).toEqual({ match: false });
        };

        test('Does not match inside $or', () => {
            noMatch({ $or: [{ groupId: 'a' }] });
            noMatch({ $or: [{ groupId: 'a' }, { firstName: 'John' }] });
        });

        test('Does not match inside $not', () => {
            noMatch({ $not: { groupId: 'a' } });
            noMatch({ $not: [{ groupId: 'a' }] });
            noMatch({ $not: { $and: [{ groupId: 'a' }] } });
        });

        test('Does not match an $or nested inside an $and or array', () => {
            noMatch({ $and: [{ $or: [{ groupId: 'a' }] }] });
            noMatch([{ $or: [{ groupId: 'a' }] }]);
            noMatch({ $and: [[{ $or: [{ groupId: 'a' }] }]] });
        });

        test('Does not match a $not nested inside an $and or array', () => {
            noMatch({ $and: [{ $not: { groupId: 'a' } }] });
            noMatch([{ $not: { groupId: 'a' } }]);
        });

        test('Does not match an $and that is an object instead of an array', () => {
            noMatch({ $and: { groupId: 'a' } });
        });

        test('Does not match an $and nested inside an $or', () => {
            noMatch({ $or: [{ $and: [{ groupId: 'a' }] }] });
        });

        test('Does not match an array nested under another key', () => {
            noMatch({ registrations: [{ groupId: 'a' }] });
            noMatch({ registrations: { $elemMatch: [{ groupId: 'a' }] } });
        });

        test('Does not match a nested wrapper with leftover keys inside the nested object', () => {
            noMatch({ registrations: { $elemMatch: { groupId: 'a' }, $not: { $elemMatch: { groupId: 'b' } } } }, nestedWrap);
            noMatch({ registrations: { $elemMatch: { groupId: 'a', $or: [{ groupId: 'b' }] } } }, nestedWrap);
        });

        test('Does not match a nested wrapper when the key is missing or shaped differently', () => {
            noMatch({ registrations: { groupId: 'a' } }, nestedWrap);
            noMatch({ groupId: 'a' }, nestedWrap);
            noMatch([{ registrations: { $elemMatch: { $or: [{ groupId: 'a' }] } } }], nestedWrap);
        });

        test('Does not match empty or null filters', () => {
            noMatch(null);
            noMatch({});
            noMatch([]);
            noMatch({ $and: [] });
            noMatch([[]]);
            noMatch({ $and: [{}] });
        });

        test('Does not match scalars', () => {
            noMatch('a');
            noMatch(['a']);
            noMatch({ $and: ['a'] });
        });
    });
});
