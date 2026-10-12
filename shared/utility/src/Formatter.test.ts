import { Formatter } from './Formatter.js';

describe('Formatter.price', () => {
    // Prices are stored as integers up to 4 digits after the decimal point (1 euro = 10000),
    // but should never be displayed with more than 2 digits after the comma. See STA-1320.

    test('never shows more than 2 digits after the comma', () => {
        for (const value of [4_99_73, 4_13_40, 4_13_50, 1_23_55, 1, 9_99_99, -4_99_73]) {
            expect(Formatter.price(value)).not.toMatch(/[.,]\d{3,}/);
        }
    });

    test('rounds the hidden extra digits to the nearest cent', () => {
        // 4,1340 -> 4,13 (rounds down)
        expect(Formatter.price(4_13_40)).toContain('4,13');
        // 4,1350 -> 4,14 (rounds half up)
        expect(Formatter.price(4_13_50)).toContain('4,14');
        // 1,2355 -> 1,24 (rounds half up)
        expect(Formatter.price(1_23_55)).toContain('1,24');
    });

    test('a value that rounds to a whole euro matches the whole euro', () => {
        // 4,9973 rounds to 5,00
        expect(Formatter.price(4_99_73)).toBe(Formatter.price(5_00_00));
    });

    test('removes zero decimals by default but keeps them when asked', () => {
        expect(Formatter.price(5_00_00)).not.toContain(',00');
        expect(Formatter.price(5_00_00, { removeZeroDecimals: false })).toContain('5,00');
        // A rounded whole euro also drops the decimals
        expect(Formatter.price(4_99_73)).not.toContain(',');
    });

    test('keeps the negative sign', () => {
        expect(Formatter.price(-4_13_40).startsWith('-')).toBe(true);
    });
});

describe('Formatter.excelDate', () => {
    test('uses the date and time in the platform timezone', () => {
        // 2010-06-15 00:00 and 2010-01-15 14:30 in Brussels
        expect(Formatter.excelDate(new Date('2010-06-14T22:00:00Z'))).toBe(40344);
        expect(Formatter.excelDate(new Date('2010-01-15T13:30:00Z'))).toBeCloseTo(40193 + 14.5 / 24, 8);
    });

    test('drops the time of date-only values', () => {
        // Birth dates stored at midnight UTC are 01:00 or 02:00 in Brussels
        expect(Formatter.excelDate(new Date('2010-06-15T00:00:00Z'), { dateOnly: true })).toBe(40344);
        expect(Formatter.excelDate(new Date('2010-01-15T00:00:00Z'), { dateOnly: true })).toBe(40193);
        expect(Formatter.excelDate(new Date('2010-01-14T23:00:00Z'), { dateOnly: true })).toBe(40193);
    });
});
