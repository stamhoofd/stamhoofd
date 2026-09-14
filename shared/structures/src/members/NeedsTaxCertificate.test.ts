import { Group } from '../Group.js';
import { GroupSettings } from '../GroupSettings.js';
import { Organization } from '../Organization.js';
import { Platform } from '../Platform.js';
import { BooleanStatus, MemberDetails } from './MemberDetails.js';
import { MemberWithRegistrationsBlob } from './MemberWithRegistrationsBlob.js';
import { PlatformFamily, PlatformMember } from './PlatformMember.js';
import { GroupPrice } from '../GroupSettings.js';
import { Registration } from './Registration.js';

describe('PlatformMember.needsTaxCertificate', () => {
    function yearsAgo(years: number) {
        const date = new Date();
        date.setFullYear(date.getFullYear() - years);
        return date;
    }

    function build({ birthDay, registeredAt, severeDisability, startDate, groupStartDate }: { birthDay: Date; registeredAt: Date | null; severeDisability?: boolean; startDate?: Date | null; groupStartDate?: Date }) {
        const organization = Organization.create({});

        const registrations = registeredAt
            ? [Registration.create({
                    registeredAt,
                    startDate: startDate === undefined ? registeredAt : startDate,
                    organizationId: organization.id,
                    groupPrice: GroupPrice.create({}),
                    group: Group.create({
                        organizationId: organization.id,
                        settings: GroupSettings.create(groupStartDate ? { startDate: groupStartDate } : {}),
                        periodId: 'period',
                    }),
                })]
            : [];

        const member = MemberWithRegistrationsBlob.create({
            registrations,
            details: MemberDetails.create({
                birthDay,
                severeDisability: severeDisability === undefined ? null : BooleanStatus.create({ value: severeDisability }),
            }),
        });

        const family = new PlatformFamily({ platform: Platform.create({}), contextOrganization: organization });
        return new PlatformMember({ member, family });
    }

    test('true when registered in the last two years while under 14', () => {
        expect(build({ birthDay: yearsAgo(12), registeredAt: yearsAgo(1) }).needsTaxCertificate).toBe(true);
    });

    test('false when the member was already 14 at the registration', () => {
        expect(build({ birthDay: yearsAgo(20), registeredAt: yearsAgo(1) }).needsTaxCertificate).toBe(false);
    });

    // The age is counted on the day of the registration, so registering a year ago
    // means the member was one year younger than they are today
    test.each([
        [14, 13, true],
        [15, 14, false],
    ])('birth %s years ago is %s at the registration: %s', (bornYearsAgo, ageAtRegistration, expected) => {
        expect(build({ birthDay: yearsAgo(bornYearsAgo), registeredAt: yearsAgo(1) }).needsTaxCertificate).toBe(expected);
    });

    test.each([
        [21, 20, true],
        [22, 21, false],
    ])('with a severe disability, birth %s years ago is %s at the registration: %s', (bornYearsAgo, ageAtRegistration, expected) => {
        expect(build({ birthDay: yearsAgo(bornYearsAgo), registeredAt: yearsAgo(1), severeDisability: true }).needsTaxCertificate).toBe(expected);
    });

    test('a registration just inside the two year window still counts', () => {
        const almostTwoYears = new Date();
        almostTwoYears.setFullYear(almostTwoYears.getFullYear() - 2);
        almostTwoYears.setDate(almostTwoYears.getDate() + 7);

        expect(build({ birthDay: yearsAgo(12), registeredAt: almostTwoYears }).needsTaxCertificate).toBe(true);
    });

    test('a registration just outside the two year window does not count', () => {
        const justOverTwoYears = new Date();
        justOverTwoYears.setFullYear(justOverTwoYears.getFullYear() - 2);
        justOverTwoYears.setDate(justOverTwoYears.getDate() - 7);

        expect(build({ birthDay: yearsAgo(12), registeredAt: justOverTwoYears }).needsTaxCertificate).toBe(false);
    });

    test('false when the only registration is older than two years', () => {
        expect(build({ birthDay: yearsAgo(12), registeredAt: yearsAgo(3) }).needsTaxCertificate).toBe(false);
    });

    test('false without any registration', () => {
        expect(build({ birthDay: yearsAgo(10), registeredAt: null }).needsTaxCertificate).toBe(false);
    });

    test('true up to 21 with a severe disability', () => {
        expect(build({ birthDay: yearsAgo(19), registeredAt: yearsAgo(1), severeDisability: true }).needsTaxCertificate).toBe(true);
    });

    test('falls back to the group start date when the registration has none', () => {
        // Registered now, but the activity itself ran three years ago
        expect(build({
            birthDay: yearsAgo(12),
            registeredAt: new Date(),
            startDate: null,
            groupStartDate: yearsAgo(3),
        }).needsTaxCertificate).toBe(false);

        expect(build({
            birthDay: yearsAgo(12),
            registeredAt: new Date(),
            startDate: null,
            groupStartDate: yearsAgo(1),
        }).needsTaxCertificate).toBe(true);
    });

    test('false past 21 even with a severe disability', () => {
        expect(build({ birthDay: yearsAgo(25), registeredAt: yearsAgo(1), severeDisability: true }).needsTaxCertificate).toBe(false);
    });
});
