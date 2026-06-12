import { Formatter } from '@stamhoofd/utility';
import { PlatformMembershipTypeBehaviour, PlatformMembershipTypeConfig } from './Platform.js';

describe('PlatformMembershipTypeConfig', () => {
    describe('getMaximumEndDate', () => {
        test('returns the configured end date for period memberships', () => {
            const endDate = new Date(2026, 4, 31, 23, 59, 59);
            const config = PlatformMembershipTypeConfig.create({
                endDate,
                maximumDays: 1,
            });

            expect(config.getMaximumEndDate(new Date(2026, 4, 1), PlatformMembershipTypeBehaviour.Period)).toBe(endDate);
        });

        test('returns the configured end date for days memberships without maximum days', () => {
            const endDate = new Date(2026, 4, 31, 23, 59, 59);
            const config = PlatformMembershipTypeConfig.create({
                endDate,
                maximumDays: null,
            });

            expect(config.getMaximumEndDate(new Date(2026, 4, 1), PlatformMembershipTypeBehaviour.Days)).toBe(endDate);
        });

        test('calculates inclusive maximum days for days memberships', () => {
            const config = PlatformMembershipTypeConfig.create({
                endDate: new Date(2026, 4, 31, 23, 59, 59),
                maximumDays: 2,
            });

            const maximumEndDate = config.getMaximumEndDate(new Date(2026, 4, 1), PlatformMembershipTypeBehaviour.Days);
            const maximumEndDateBrussels = Formatter.luxon(maximumEndDate);

            expect(maximumEndDateBrussels.year).toBe(2026);
            expect(maximumEndDateBrussels.month).toBe(5);
            expect(maximumEndDateBrussels.day).toBe(2);
            expect(maximumEndDateBrussels.hour).toBe(23);
            expect(maximumEndDateBrussels.minute).toBe(59);
            expect(maximumEndDateBrussels.second).toBe(59);
        });
    });
});
