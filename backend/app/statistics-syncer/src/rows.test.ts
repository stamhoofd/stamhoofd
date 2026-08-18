import { describe, expect, it } from 'vitest';
import { flattenGroup, flattenMember, flattenOrganization, flattenPlatform, flattenRegistration } from './rows.js';

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
        expect(flattenMember(member, 'period-1').birthDate).toBe('2011-05-17');
    });

    /**
     * A birth date is held as midnight in Europe/Brussels. Writing that instant into a date column
     * from a process running in UTC would land on the day before.
     */
    it('writes the calendar date the application means, not the instant behind it', () => {
        const brusselsMidnight = new Date('2011-05-16T22:00:00.000Z');

        expect(flattenMember({ ...member, details: { ...member.details, birthDay: brusselsMidnight } }, 'period-1').birthDate).toBe('2011-05-17');
    });

    it('never carries a name or a way to contact the member', () => {
        const row = flattenMember({ ...member, details: { ...member.details, firstName: 'Jan', lastName: 'Jansen', email: 'jan@example.com' } as any }, 'period-1');

        expect(Object.keys(row).sort()).toEqual(['birthDate', 'createdAt', 'gender', 'id', 'lastRegisteredAt', 'organizationId', 'periodId', 'postalCode', 'updatedAt']);
        expect(JSON.stringify(row)).not.toContain('Jan');
        expect(JSON.stringify(row)).not.toContain('example.com');
    });

    /**
     * The same member in two years is two rows, so that correcting a gender or moving house changes
     * the year it happened in rather than every year the member was ever counted in.
     */
    it('describes the member in one period, which is part of what identifies the row', () => {
        const first = flattenMember(member, 'period-1');
        const second = flattenMember(member, 'period-2');

        expect(first.periodId).toBe('period-1');
        expect(second.periodId).toBe('period-2');
        expect(first.id).toBe(second.id);
    });

    it('keeps a member without a birth date', () => {
        expect(flattenMember({ ...member, details: { birthDay: null, gender: 'Other', address: null } }, 'period-1').birthDate).toBeNull();
    });

    it('keeps the postal code the member map needs, and nothing else of the address', () => {
        const row = flattenMember({ ...member, details: { ...member.details, address: { postalCode: '9000', street: 'Somewhere', city: 'Gent' } as any } }, 'period-1');

        expect(row.postalCode).toBe('9000');
        expect(JSON.stringify(row)).not.toContain('Somewhere');
        expect(JSON.stringify(row)).not.toContain('Gent');
    });

    it('has no postal code for a member without an address', () => {
        expect(flattenMember({ ...member, details: { ...member.details, address: null } }, 'period-1').postalCode).toBeNull();
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
        const row = flattenOrganization(organization, 'period-1');

        expect(row.postalCode).toBe('9000');
        expect(row.city).toBe('Gent');
        expect(Object.keys(row)).not.toContain('address');
        expect(JSON.stringify(row)).not.toContain('Somewhere');
    });

    it('stores a missing postal code as null rather than an empty string', () => {
        expect(flattenOrganization({ ...organization, address: { postalCode: '', city: '' } }, 'period-1').postalCode).toBeNull();
    });

    /**
     * A unit that is renamed or moves keeps the name and the place it was counted under in the years
     * already settled, so the year is what the row describes rather than the period it is in now.
     */
    it('describes the unit in one period, not the period the unit is in now', () => {
        expect(flattenOrganization(organization, 'period-2').periodId).toBe('period-2');
    });
});

describe('flattenPlatform', () => {
    const platform = {
        id: 'platform-1',
        config: { name: 'Scouts en Gidsen Vlaanderen' },
        membershipOrganizationId: 'org-1',
    };

    /**
     * The organization the koepel runs itself is what the jeugdbewegingen report delivers as the
     * bovenlokale ondersteuningsstructuur, and nothing else in the administration tells it apart from
     * a local group.
     */
    it('keeps the name and the organization the platform runs itself', () => {
        expect(flattenPlatform(platform)).toEqual({ id: 'platform-1', name: 'Scouts en Gidsen Vlaanderen', membershipOrganizationId: 'org-1' });
    });

    it('stores no organization for a platform that runs none', () => {
        expect(flattenPlatform({ ...platform, membershipOrganizationId: null }).membershipOrganizationId).toBeNull();
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
