import { TestUtils } from '@stamhoofd/test-utils';
import { getImportedUntil, isFrozen } from './periods.js';

describe('getImportedUntil', () => {
    it('reads the boundary of a platform that has external history', () => {
        TestUtils.setEnvironment('IMPORTED_UNTIL', '2024-09-01');

        expect(getImportedUntil()).toEqual(new Date('2024-09-01'));
    });

    it('has no boundary for a platform without external history, so nothing is frozen up front', () => {
        TestUtils.setEnvironment('IMPORTED_UNTIL', undefined);

        expect(getImportedUntil()).toBeNull();
    });

    it('refuses a boundary it cannot read rather than silently freezing nothing', () => {
        TestUtils.setEnvironment('IMPORTED_UNTIL', 'last september');

        expect(() => getImportedUntil()).toThrow('not a valid date');
    });
});

describe('isFrozen', () => {
    const frozen = new Set(['period-2023']);

    it('freezes a row of a settled period', () => {
        expect(isFrozen(frozen, 'period-2023')).toBe(true);
    });

    it('leaves a row of a live period alone', () => {
        expect(isFrozen(frozen, 'period-2026')).toBe(false);
    });

    it('treats a row without a period as live, since it is part of no settled year', () => {
        expect(isFrozen(frozen, null)).toBe(false);
        expect(isFrozen(frozen, undefined)).toBe(false);
    });
});
