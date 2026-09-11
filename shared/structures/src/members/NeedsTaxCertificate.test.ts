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
