import { RegistrationPeriod } from '@stamhoofd/structures';
import { isValidRegistrationPeriodCustomName } from './isValidRegistrationPeriodCustomName';

function createPeriod(customName: string | null, startYear = 2026, endYear = 2027) {
    return RegistrationPeriod.create({
        customName,
        startDate: new Date(startYear, 0, 1),
        endDate: new Date(endYear, 11, 31),
    });
}

describe('isValidRegistrationPeriodCustomName', () => {
    test.each([
        [null],
        [''],
        ['Gearchiveerde periodes'],
        ['Test 27'],
        ['Test 2027'],
        ['Periode 26-27'],
        ['Periode 2026 - 2027'],
    ])('returns true for %s', (customName) => {
        expect(isValidRegistrationPeriodCustomName(createPeriod(customName))).toBe(true);
    });

    test.each([
        ['Test zonder jaar'],
        ['Test 28'],
        ['2027 Test'],
    ])('returns false for %s', (customName) => {
        expect(isValidRegistrationPeriodCustomName(createPeriod(customName))).toBe(false);
    });

    it('keeps extreme date ranges valid', () => {
        expect(isValidRegistrationPeriodCustomName(createPeriod('Test 27', 1800, 2027))).toBe(true);
        expect(isValidRegistrationPeriodCustomName(createPeriod('Test 27', 2027, 10000))).toBe(true);
        expect(isValidRegistrationPeriodCustomName(createPeriod('Test 27', 2027, 2026))).toBe(true);
    });
});
