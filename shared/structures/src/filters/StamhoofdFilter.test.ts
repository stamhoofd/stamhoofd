import { getAndFilterParts, mergeFilters } from './StamhoofdFilter.js';

describe('Unit.StamhoofdFilter', () => {
    describe('getAndFilterParts', () => {
        test('A filter that is not a conjunction is its own only part', () => {
            const filter = { groupId: 'group-1' };

            expect(getAndFilterParts(filter)).toEqual([filter]);
        });

        test('Reads back both shapes mergeFilters can build', () => {
            const a = { groupId: 'group-1' };
            const b = { deactivatedAt: null };

            // One filter stays as is, more than one becomes an $and
            expect(getAndFilterParts(mergeFilters([a]))).toEqual([a]);
            expect(getAndFilterParts(mergeFilters([a, b]))).toEqual([a, b]);

            // A bare array is the same conjunction
            expect(getAndFilterParts([a, b])).toEqual([a, b]);
        });

        test('Flattens nested conjunctions', () => {
            const a = { groupId: 'group-1' };
            const b = { deactivatedAt: null };
            const c = { registeredAt: { $neq: null } };

            expect(getAndFilterParts({ $and: [a, [b, { $and: [c] }]] })).toEqual([a, b, c]);
        });

        test('Keeps keys that sit next to $and', () => {
            const a = { groupId: 'group-1' };

            expect(getAndFilterParts({ $and: [a], organizationId: 'org-1' })).toEqual([a, { organizationId: 'org-1' }]);
        });

        test('Leaves $or alone: its parts are not ANDed', () => {
            const filter = { $or: [{ groupId: 'group-1' }, { groupId: 'group-2' }] };

            expect(getAndFilterParts(filter)).toEqual([filter]);
        });
    });
});
