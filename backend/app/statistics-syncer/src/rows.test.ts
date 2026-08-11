import { describe, expect, it } from 'vitest';
import { flattenGroup, flattenMember, flattenOrganization, flattenRegistration } from './rows.js';

describe('flattenMember', () => {
    const member = {
        id: 'member-1',
        details: { birthDay: new Date(2011, 4, 17), gender: 'Female', address: { postalCode: '9000' } },
        organizationId: 'org-1',
        createdAt: new Date(2025, 0, 1),
        updatedAt: new Date(2026, 0, 1),
        lastRegisteredAt: new Date(2025, 8, 1),
    };

    it('carries the date of birth, which is what makes an age exact', () => {
        expect(flattenMember(member).birthDate).toBe('2011-05-17');
    });

    /**
     * A birth date is held as midnight in Europe/Brussels. Writing that instant into a date column
     * from a process running in UTC would land on the day before.
     */
    it('writes the calendar date the application means, not the instant behind it', () => {
        const brusselsMidnight = new Date('2011-05-16T22:00:00.000Z');

        expect(flattenMember({ ...member, details: { ...member.details, birthDay: brusselsMidnight } }).birthDate).toBe('2011-05-17');
    });

    it('never carries a name or a way to contact the member', () => {
        const row = flattenMember({ ...member, details: { ...member.details, firstName: 'Jan', lastName: 'Jansen', email: 'jan@example.com' } as any });

        expect(Object.keys(row).sort()).toEqual(['birthDate', 'createdAt', 'gender', 'id', 'lastRegisteredAt', 'organizationId', 'postalCode', 'updatedAt']);
        expect(JSON.stringify(row)).not.toContain('Jan');
        expect(JSON.stringify(row)).not.toContain('example.com');
    });

    it('keeps a member without a birth date', () => {
        expect(flattenMember({ ...member, details: { birthDay: null, gender: 'Other', address: null } }).birthDate).toBeNull();
    });

    it('keeps the postal code the member map needs, and nothing else of the address', () => {
        const row = flattenMember({ ...member, details: { ...member.details, address: { postalCode: '9000', street: 'Somewhere', city: 'Gent' } as any } });

        expect(row.postalCode).toBe('9000');
        expect(JSON.stringify(row)).not.toContain('Somewhere');
        expect(JSON.stringify(row)).not.toContain('Gent');
    });

    it('has no postal code for a member without an address', () => {
        expect(flattenMember({ ...member, details: { ...member.details, address: null } }).postalCode).toBeNull();
    });
});

describe('flattenOrganization', () => {
    const organization = {
        id: 'org-1',
        name: 'Scouts Test',
        uri: 'scouts-test',
        address: { postalCode: '9000', city: 'Gent', street: 'Somewhere' } as any,
        periodId: 'period-1',
        active: true,
        createdAt: new Date(2025, 0, 1),
        updatedAt: new Date(2026, 0, 1),
    };

    it('keeps the postal code the map needs and the city the ULDK table lists, and no more', () => {
        const row = flattenOrganization(organization);

        expect(row.postalCode).toBe('9000');
        expect(row.city).toBe('Gent');
        expect(Object.keys(row)).not.toContain('address');
        expect(JSON.stringify(row)).not.toContain('Somewhere');
    });

    it('stores a missing postal code as null rather than an empty string', () => {
        expect(flattenOrganization({ ...organization, address: { postalCode: '', city: '' } }).postalCode).toBeNull();
    });
});

describe('flattenGroup', () => {
    it('resolves the translated name in a fixed language, not whatever the process is set to', () => {
        const row = flattenGroup({
            id: 'group-1',
            type: 'Membership',
            settings: { name: { get: language => language === 'nl' ? 'Bevers' : 'Beavers' } },
            organizationId: 'org-1',
            periodId: 'period-1',
            defaultAgeGroupId: 'age-1',
            cycle: 0,
            status: 'Open',
            deletedAt: null,
            createdAt: new Date(2025, 0, 1),
            updatedAt: new Date(2026, 0, 1),
        });

        expect(row.name).toBe('Bevers');
        expect(Object.keys(row)).not.toContain('settings');
    });
});

describe('flattenRegistration', () => {
    it('keeps the member and group it links, and drops the answers and prices', () => {
        const row = flattenRegistration({
            id: 'registration-1',
            organizationId: 'org-1',
            memberId: 'member-1',
            groupId: 'group-1',
            periodId: 'period-1',
            registeredAt: new Date(2025, 8, 1),
            startDate: null,
            endDate: null,
            trialUntil: null,
            deactivatedAt: null,
            waitingList: false,
            cycle: 0,
            createdAt: new Date(2025, 0, 1),
            updatedAt: new Date(2026, 0, 1),
        });

        expect(row.memberId).toBe('member-1');
        expect(row.groupId).toBe('group-1');
        for (const dropped of ['recordAnswers', 'price', 'pricePaid', 'groupPrice', 'paymentId', 'options']) {
            expect(Object.keys(row)).not.toContain(dropped);
        }
    });
});
