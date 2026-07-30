import { ObjectData } from '@simonbackx/simple-encoding';
import { Formatter } from '@stamhoofd/utility';
import { Platform, PlatformMembershipTypeBehaviour, PlatformMembershipTypeConfig } from './Platform.js';
import { Version } from './Version.js';

describe('PlatformMembershipTypeConfig', () => {
    describe('getMaximumEndDate', () => {
        test('returns the configured end date for period memberships', () => {
            const endDate = Formatter.luxon().set({ year: 2026, month: 5, day: 31, hour: 23, minute: 59, second: 59, millisecond: 0 }).toJSDate();
            const startDate = Formatter.luxon().set({ year: 2026, month: 5, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 }).toJSDate();
            const config = PlatformMembershipTypeConfig.create({
                endDate,
                maximumDays: 1,
            });
            const maximumEndDate = config.getMaximumEndDate(
                startDate,
                PlatformMembershipTypeBehaviour.Period,
            );
            const maximumEndDateBrussels = Formatter.luxon(maximumEndDate);

            expect(maximumEndDateBrussels.year).toBe(2026);
            expect(maximumEndDateBrussels.month).toBe(5);
            expect(maximumEndDateBrussels.day).toBe(31);
            expect(maximumEndDateBrussels.hour).toBe(23);
            expect(maximumEndDateBrussels.minute).toBe(59);
            expect(maximumEndDateBrussels.second).toBe(59);
        });

        test('returns the configured end date for days memberships without maximum days', () => {
            const endDate = Formatter.luxon().set({ year: 2026, month: 5, day: 31, hour: 23, minute: 59, second: 59, millisecond: 0 }).toJSDate();
            const startDate = Formatter.luxon().set({ year: 2026, month: 5, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 }).toJSDate();
            const config = PlatformMembershipTypeConfig.create({
                endDate,
                maximumDays: null,
            });
            const maximumEndDate = config.getMaximumEndDate(startDate, PlatformMembershipTypeBehaviour.Days);
            const maximumEndDateBrussels = Formatter.luxon(maximumEndDate);

            expect(maximumEndDateBrussels.year).toBe(2026);
            expect(maximumEndDateBrussels.month).toBe(5);
            expect(maximumEndDateBrussels.day).toBe(31);
            expect(maximumEndDateBrussels.hour).toBe(23);
            expect(maximumEndDateBrussels.minute).toBe(59);
            expect(maximumEndDateBrussels.second).toBe(59);
        });

        test('calculates inclusive maximum days for days memberships', () => {
            const endDate = Formatter.luxon().set({ year: 2026, month: 5, day: 31, hour: 23, minute: 59, second: 59, millisecond: 0 }).toJSDate();
            const startDate = Formatter.luxon().set({ year: 2026, month: 5, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 }).toJSDate();
            const config = PlatformMembershipTypeConfig.create({
                endDate,
                maximumDays: 2,
            });

            const maximumEndDate = config.getMaximumEndDate(startDate, PlatformMembershipTypeBehaviour.Days);
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

describe('Platform tenant identity', () => {
    function roundtrip(platform: Platform, version: number = Version): Platform {
        const encoded = JSON.parse(JSON.stringify(platform.encode({ version })));
        return Platform.decode(new ObjectData(encoded, { version }));
    }

    test('the identity survives an encode and decode', () => {
        const platform = Platform.create({
            id: 'tenant-a',
            parentTenantId: 'tenant-root',
            feesTenantId: 'tenant-root',
            uri: 'tenant-a',
            domain: 'a.example.com',
        });

        const decoded = roundtrip(platform);

        expect(decoded.id).toBe('tenant-a');
        expect(decoded.parentTenantId).toBe('tenant-root');
        expect(decoded.feesTenantId).toBe('tenant-root');
        expect(decoded.uri).toBe('tenant-a');
        expect(decoded.domain).toBe('a.example.com');
    });

    test('a root tenant has no parent and charges its own fees', () => {
        const decoded = roundtrip(Platform.create({ id: '1', feesTenantId: '1' }));

        expect(decoded.parentTenantId).toBeNull();
        expect(decoded.feesTenantId).toBe('1');
    });

    test('data stored before tenants existed still decodes', () => {
        // A client on an older version never sent these fields
        const decoded = Platform.decode(new ObjectData({
            config: {},
            privateConfig: null,
            period: Platform.create({}).period.encode({ version: Version - 1 }),
        }, { version: Version - 1 }));

        expect(decoded.id).toBe('');
        expect(decoded.parentTenantId).toBeNull();
        expect(decoded.feesTenantId).toBeNull();
        expect(decoded.uri).toBeNull();
        expect(decoded.domain).toBeNull();
    });

    test('an older client is not sent the tenant identity', () => {
        const platform = Platform.create({ id: 'tenant-a', uri: 'tenant-a' });

        const encoded = platform.encode({ version: Version - 1 }) as Record<string, unknown>;

        expect(encoded.id).toBeUndefined();
        expect(encoded.uri).toBeUndefined();
    });
});
