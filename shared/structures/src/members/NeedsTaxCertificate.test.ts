import { Group } from '../Group.js';
import { GroupSettings } from '../GroupSettings.js';
import { GroupType } from '../GroupType.js';
import { Organization } from '../Organization.js';
import { Platform } from '../Platform.js';
import { BooleanStatus, MemberDetails } from './MemberDetails.js';
import { MemberWithRegistrationsBlob } from './MemberWithRegistrationsBlob.js';
import { PlatformFamily, PlatformMember } from './PlatformMember.js';
import { GroupPrice } from '../GroupSettings.js';
import { RegisterItem } from './checkout/RegisterItem.js';
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

    // A member signing up for the first time has no registrations yet, only cart items
    describe('without any registration yet', () => {
        function buildWithItem({ birthDay, groupType, groupStartDate, pending = false, forOtherMember = false }: { birthDay: Date; groupType?: GroupType; groupStartDate?: Date; pending?: boolean; forOtherMember?: boolean }) {
            const organization = Organization.create({});
            const family = new PlatformFamily({ platform: Platform.create({}), contextOrganization: organization });

            const create = (details: MemberDetails) => {
                const member = new PlatformMember({
                    member: MemberWithRegistrationsBlob.create({ registrations: [], details }),
                    family,
                });
                family.members.push(member);
                return member;
            };

            const member = create(MemberDetails.create({ birthDay }));
            const itemMember = forOtherMember ? create(MemberDetails.create({ birthDay })) : member;

            const group = Group.create({
                organizationId: organization.id,
                type: groupType ?? GroupType.Membership,
                // A group that already ended falls back to its own start date instead of today
                settings: GroupSettings.create(groupStartDate ? { startDate: groupStartDate, endDate: groupStartDate } : {}),
                periodId: 'period',
            });

            const item = RegisterItem.defaultFor(itemMember, group, organization);

            if (pending) {
                family.pendingRegisterItems.push(item);
            }
            else {
                family.checkout.cart.items.push(item);
            }

            return member;
        }

        test('true for a member in the cart while under 14', () => {
            expect(buildWithItem({ birthDay: yearsAgo(12) }).needsTaxCertificate).toBe(true);
        });

        test('true for an item that is not in the cart yet', () => {
            expect(buildWithItem({ birthDay: yearsAgo(12), pending: true }).needsTaxCertificate).toBe(true);
        });

        test('false when the member is too old for the group in the cart', () => {
            expect(buildWithItem({ birthDay: yearsAgo(20) }).needsTaxCertificate).toBe(false);
        });

        // Asking only once the spot is confirmed would leave the member with missing data
        test('true for a waiting list spot, so the data is collected up front', () => {
            expect(buildWithItem({ birthDay: yearsAgo(12), groupType: GroupType.WaitingList }).needsTaxCertificate).toBe(true);
        });

        test('a cart item of a sibling does not count', () => {
            expect(buildWithItem({ birthDay: yearsAgo(12), forOtherMember: true }).needsTaxCertificate).toBe(false);
        });

        test('false when the group in the cart ran more than two years ago', () => {
            expect(buildWithItem({ birthDay: yearsAgo(12), groupStartDate: yearsAgo(3) }).needsTaxCertificate).toBe(false);
        });
    });
});
