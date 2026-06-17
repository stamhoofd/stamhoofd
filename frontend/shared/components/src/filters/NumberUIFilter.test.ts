import type { StamhoofdFilter } from '@stamhoofd/structures';
import { describe, expect, test } from 'vitest';
import { NumberFilterBuilder, NumberUIFilter } from './NumberUIFilter';
import { UINumberFilterMode } from './UINumberFilterMode.ts';

describe('NumberUIFilter', () => {
    const builder = new NumberFilterBuilder({
        key: 'amount',
        name: 'Amount',
    });

    test('builds and decodes all modes round-trip', () => {
        const cases: { mode: UINumberFilterMode; expected: StamhoofdFilter }[] = [
            { mode: UINumberFilterMode.Equals, expected: { amount: { $eq: 5 } } },
            { mode: UINumberFilterMode.NotEquals, expected: { $not: { amount: { $eq: 5 } } } },
            { mode: UINumberFilterMode.GreaterThan, expected: { amount: { $gt: 5 } } },
            { mode: UINumberFilterMode.GreaterThanOrEqual, expected: { amount: { $gte: 5 } } },
            { mode: UINumberFilterMode.LessThan, expected: { amount: { $lt: 5 } } },
            { mode: UINumberFilterMode.LessThanOrEqual, expected: { amount: { $lte: 5 } } },
        ];

        for (const { mode, expected } of cases) {
            const filter = new NumberUIFilter({ builder, value: 5, mode });
            expect(filter.build()).toEqual(expected);

            const decoded = builder.fromFilter(expected);
            expect(decoded).not.toBeNull();
            expect((decoded as NumberUIFilter).mode).toBe(mode);
            expect((decoded as NumberUIFilter).value).toBe(5);
        }
    });

    test('decodes $gte filter (regression for STA-1101)', () => {
        const decoded = builder.fromFilter({ amount: { $gte: 10 } });
        expect(decoded).not.toBeNull();
        expect((decoded as NumberUIFilter).mode).toBe(UINumberFilterMode.GreaterThanOrEqual);
        expect((decoded as NumberUIFilter).value).toBe(10);
    });

    test('decodes $lte filter (regression for STA-1101)', () => {
        const decoded = builder.fromFilter({ amount: { $lte: 10 } });
        expect(decoded).not.toBeNull();
        expect((decoded as NumberUIFilter).mode).toBe(UINumberFilterMode.LessThanOrEqual);
        expect((decoded as NumberUIFilter).value).toBe(10);
    });
});
