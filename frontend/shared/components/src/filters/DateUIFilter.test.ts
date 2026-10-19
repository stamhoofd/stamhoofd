import { describe, expect, test } from 'vitest';
import { DateFilterBuilder, DateUIFilter, UIDateFilterMode } from './DateUIFilter';

describe('DateUIFilter', () => {
    const builder = new DateFilterBuilder({
        key: 'createdAt',
        name: 'Created at',
    });

    // 1 March 2026 in Belgian time (UTC+1), as chosen by DateSelection
    const value = new Date('2026-02-28T23:00:00.000Z');
    const startOfDay = new Date('2026-02-28T23:00:00.000Z');
    const endOfDay = new Date('2026-03-01T22:59:59.999Z');

    test('uses the day in Belgian time, regardless of the browser timezone', () => {
        expect(new DateUIFilter({ builder, value, mode: UIDateFilterMode.Equals }).build()).toEqual({
            $and: [
                { createdAt: { $gte: startOfDay } },
                { createdAt: { $lte: endOfDay } },
            ],
        });

        expect(new DateUIFilter({ builder, value, mode: UIDateFilterMode.NotEquals }).build()).toEqual({
            $or: [
                { createdAt: { $lt: startOfDay } },
                { createdAt: { $gt: endOfDay } },
            ],
        });

        expect(new DateUIFilter({ builder, value, mode: UIDateFilterMode.GreaterThan }).build()).toEqual({
            createdAt: { $gt: endOfDay },
        });

        expect(new DateUIFilter({ builder, value, mode: UIDateFilterMode.LessThan }).build()).toEqual({
            createdAt: { $lt: startOfDay },
        });
    });
});
