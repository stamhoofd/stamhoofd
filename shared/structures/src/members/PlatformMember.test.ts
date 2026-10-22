import { MembersBlob, MemberWithRegistrationsBlob } from './MemberWithRegistrationsBlob.js';
import { MemberPlatformMembership } from './MemberPlatformMembership.js';
import { Platform, PlatformConfig, PlatformMembershipType } from '../Platform.js';
import { Organization } from '../Organization.js';
import { Group } from '../Group.js';
import { GroupPrice, GroupSettings } from '../GroupSettings.js';
import { GroupType } from '../GroupType.js';
import { PlatformMembershipTypeBehaviour } from '../PlatformMembershipTypeBehaviour.js';
import { OrganizationRegistrationPeriod, RegistrationPeriod } from '../RegistrationPeriod.js';
import { Registration } from './Registration.js';
import { OrganizationMetaData } from '../OrganizationMetaData.js';
import { MemberDetails } from './MemberDetails.js';
import { ContinuousMembershipStatus } from './MembershipStatus.js';
import { OrganizationRecordsConfiguration } from './OrganizationRecordsConfiguration.js';
import { RecordCategory } from './records/RecordCategory.js';
import { TranslatedString } from '../TranslatedString.js';
import {
    PlatformFamily,
    PlatformMember,
} from './PlatformMember.js';

describe('PlatformMember', () => {
    describe('getContinuousMembershipStatus', () => {
        test('no memberships in period should return status None', () => {
            const start = new Date(2024, 0, 1);
            const end = new Date(2024, 11, 31);

            const membershipDates: { start: Date; end: Date }[] = [
                {
                    start: new Date(2023, 0, 1),
                    end: new Date(2023, 11, 31),
                },
                {
                    start: new Date(2025, 0, 1),
                    end: new Date(2025, 11, 31),
                },
            ];

            const organization = Organization.create({});

            const platformMemberships = membershipDates.map(({ start, end }) => {
                return MemberPlatformMembership.create({
                    startDate: start,
                    endDate: end,
                    organizationId: organization.id,
                });
            });

            const member = MemberWithRegistrationsBlob.create({
                platformMemberships,
                details: MemberDetails.create({}),
            });

            const family = new PlatformFamily({
                platform: Platform.create({}),
                contextOrganization: organization,
            });

            const platformMember = new PlatformMember({
                member,
                family,
            });

            // act
            const status = platformMember.getContinuousMembershipStatus({
                start,
                end,
            });

            // assert
            expect(status).toBe(ContinuousMembershipStatus.None);
        });

        test('memberships covering partial period should return status Partial', () => {
            const start = new Date(2024, 0, 1);
            const end = new Date(2024, 11, 31);

            const cases: { start: Date; end: Date }[][] = [
                [
                    {
                        start: new Date(2024, 0, 1),
                        end: new Date(2024, 0, 5),
                    },
                ],
                [
                    {
                        start: new Date(2023, 11, 31),
                        end: new Date(2024, 0, 5),
                    },
                ],
                [
                    {
                        start: new Date(2024, 11, 30),
                        end: new Date(2024, 11, 31),
                    },
                ],
                [
                    {
                        start: new Date(2024, 11, 30),
                        end: new Date(2025, 0, 1),
                    },
                ],
                [
                    {
                        start: new Date(2024, 1, 2),
                        end: new Date(2024, 1, 7),
                    },
                ],
                [
                    {
                        start: new Date(2024, 1, 2),
                        end: new Date(2024, 1, 7),
                    },
                    {
                        start: new Date(2024, 2, 2),
                        end: new Date(2024, 2, 7),
                    },
                ],
            ];

            for (const membershipDates of cases) {
                const organization = Organization.create({});

                const platformMemberships = membershipDates.map(({ start, end }) => {
                    return MemberPlatformMembership.create({
                        startDate: start,
                        endDate: end,
                        organizationId: organization.id,
                    });
                });

                const member = MemberWithRegistrationsBlob.create({
                    platformMemberships,
                    details: MemberDetails.create({}),
                });

                const family = new PlatformFamily({
                    platform: Platform.create({}),
                    contextOrganization: organization,
                });

                const platformMember = new PlatformMember({
                    member,
                    family,
                });

                // act
                const status = platformMember.getContinuousMembershipStatus({
                    start,
                    end,
                });

                // assert
                expect(status).toBe(ContinuousMembershipStatus.Partial);
            }
        });

        test('memberships covering full period should return status Full', () => {
            const start = new Date(2024, 0, 1);
            const end = new Date(2024, 11, 31);

            const cases: { start: Date; end: Date }[][] = [
                [
                    {
                        start: new Date(2024, 0, 1),
                        end: new Date(2024, 11, 31),
                    },
                ],
                [
                    {
                        start: new Date(2024, 0, 1),
                        end: new Date(2025, 0, 1),
                    },
                ],
                [
                    {
                        start: new Date(2023, 11, 31),
                        end: new Date(2024, 11, 31),
                    },
                ],
                [
                    {
                        start: new Date(2023, 11, 31),
                        end: new Date(2025, 0, 1),
                    },
                ],
                [
                    {
                        start: new Date(2024, 5, 30),
                        end: new Date(2024, 11, 31),
                    },
                    {
                        start: new Date(2024, 0, 1),
                        end: new Date(2024, 5, 30),
                    },
                ],
                [
                    {
                        start: new Date(2024, 3, 20),
                        end: new Date(2024, 6, 24),
                    },
                    {
                        start: new Date(2024, 5, 30),
                        end: new Date(2024, 11, 31),
                    },
                    {
                        start: new Date(2024, 0, 1),
                        end: new Date(2024, 3, 31),
                    },
                ],
                [
                    {
                        start: new Date(2024, 3, 20),
                        end: new Date(2024, 6, 24),
                    },
                    {
                        start: new Date(2024, 5, 30),
                        end: new Date(2025, 0, 1),
                    },
                    {
                        start: new Date(2023, 11, 31),
                        end: new Date(2024, 3, 31),
                    },
                ],
            ];

            for (const membershipDates of cases) {
                const organization = Organization.create({});

                const platformMemberships = membershipDates.map(({ start, end }) => {
                    return MemberPlatformMembership.create({
                        startDate: start,
                        endDate: end,
                        organizationId: organization.id,
                    });
                });

                const member = MemberWithRegistrationsBlob.create({
                    platformMemberships,
                    details: MemberDetails.create({}),
                });

                const family = new PlatformFamily({
                    platform: Platform.create({}),
                    contextOrganization: organization,
                });

                const platformMember = new PlatformMember({
                    member,
                    family,
                });

                // act
                const status = platformMember.getContinuousMembershipStatus({
                    start,
                    end,
                });

                // assert
                expect(status).toBe(ContinuousMembershipStatus.Full);
            }
        });
    });

    describe('getAllRecordCategories', () => {
        test('does not return the same record category twice when the member belongs to the scoped organization', () => {
            const categoryA = RecordCategory.create({ name: new TranslatedString('Category A') });
            const categoryB = RecordCategory.create({ name: new TranslatedString('Category B') });

            const organization = Organization.create({
                meta: OrganizationMetaData.create({
                    recordsConfiguration: OrganizationRecordsConfiguration.create({
                        recordCategories: [categoryA, categoryB],
                    }),
                }),
            });

            const blob = MembersBlob.create({
                organizations: [organization],
                members: [
                    MemberWithRegistrationsBlob.create({
                        organizationId: organization.id,
                        details: MemberDetails.create({}),
                    }),
                ],
            });

            const family = PlatformFamily.create(blob, { platform: Platform.create({}), contextOrganization: organization });
            const member = family.members[0];

            const categories = member.getAllRecordCategories({ scopeOrganization: organization });

            expect(categories.map(c => c.id)).toEqual([categoryA.id, categoryB.id]);
        });
    });

    describe('getPrimaryOrganization', () => {
        const twoYearsAgo = RegistrationPeriod.create({ startDate: new Date('2023-09-01T00:00:00Z'), endDate: new Date('2024-08-31T00:00:00Z') });
        const previous = RegistrationPeriod.create({ startDate: new Date('2024-09-01T00:00:00Z'), endDate: new Date('2025-08-31T00:00:00Z') });
        const current = RegistrationPeriod.create({ startDate: new Date('2025-09-01T00:00:00Z'), endDate: new Date('2026-08-31T00:00:00Z') });
        const next = RegistrationPeriod.create({ startDate: new Date('2026-09-01T00:00:00Z'), endDate: new Date('2027-08-31T00:00:00Z') });

        const fullType = PlatformMembershipType.create({ behaviour: PlatformMembershipTypeBehaviour.Period });
        const temporaryType = PlatformMembershipType.create({ behaviour: PlatformMembershipTypeBehaviour.Days });

        const national = Organization.create({ name: 'National', uri: 'NAT' });
        const groupA = Organization.create({ name: 'Group A', uri: 'A' });
        const groupB = Organization.create({ name: 'Group B', uri: 'B' });

        const platform = Platform.create({
            period: current,
            membershipOrganizationId: national.id,
            config: PlatformConfig.create({ membershipTypes: [fullType, temporaryType] }),
        });

        function registration(organization: Organization, period: RegistrationPeriod, options: { registeredAt?: string; defaultAgeGroup?: boolean; type?: GroupType; deactivated?: boolean; waitingList?: boolean } = {}) {
            return Registration.create({
                organizationId: organization.id,
                group: Group.create({
                    organizationId: organization.id,
                    periodId: period.id,
                    type: options.type ?? GroupType.Membership,
                    defaultAgeGroupId: options.defaultAgeGroup ? 'default-age-group' : null,
                    settings: GroupSettings.create({ period }),
                }),
                groupPrice: GroupPrice.create({}),
                registeredAt: options.waitingList ? null : new Date(options.registeredAt ?? '2025-09-15T00:00:00Z'),
                deactivatedAt: options.deactivated ? new Date('2025-10-01T00:00:00Z') : null,
            });
        }

        function membership(organization: Organization, period: RegistrationPeriod, type: PlatformMembershipType, startDate = '2025-09-15T00:00:00Z') {
            return MemberPlatformMembership.create({
                organizationId: organization.id,
                periodId: period.id,
                membershipTypeId: type.id,
                startDate: new Date(startDate),
            });
        }

        function getPrimaryOrganizationUri(registrations: Registration[], platformMemberships: MemberPlatformMembership[] = [], periodId = current.id) {
            const blob = MembersBlob.create({
                organizations: [national, groupA, groupB],
                members: [MemberWithRegistrationsBlob.create({ details: MemberDetails.create({}), registrations, platformMemberships })],
            });
            const family = PlatformFamily.create(blob, { platform });
            return family.members[0].getPrimaryOrganization({ periodId })?.uri ?? null;
        }

        test('ignores the national organization when the member has a local group', () => {
            expect(getPrimaryOrganizationUri([
                registration(national, current, { registeredAt: '2025-10-01T00:00:00Z' }),
                registration(groupA, current),
            ])).toBe('A');
        });

        test('only returns the national organization when the member never had a local group', () => {
            expect(getPrimaryOrganizationUri([registration(national, current)])).toBe('NAT');
            expect(getPrimaryOrganizationUri([registration(national, previous)])).toBe('NAT');
            expect(getPrimaryOrganizationUri([registration(national, next)])).toBe(null);
            expect(getPrimaryOrganizationUri([])).toBe(null);
        });

        test('prefers the group with a full membership, then a temporary one, regardless of registration date', () => {
            const registrations = [
                registration(groupA, current, { registeredAt: '2025-09-15T00:00:00Z' }),
                registration(groupB, current, { registeredAt: '2025-10-15T00:00:00Z', defaultAgeGroup: true }),
            ];
            expect(getPrimaryOrganizationUri(registrations, [membership(groupA, current, fullType)])).toBe('A');
            expect(getPrimaryOrganizationUri(registrations, [membership(groupA, current, temporaryType)])).toBe('A');
            expect(getPrimaryOrganizationUri(registrations, [
                membership(groupA, current, fullType),
                membership(groupB, current, temporaryType, '2025-11-01T00:00:00Z'),
            ])).toBe('A');
            expect(getPrimaryOrganizationUri(registrations, [
                membership(groupA, current, temporaryType, '2025-11-01T00:00:00Z'),
                membership(groupB, current, temporaryType, '2025-10-01T00:00:00Z'),
            ])).toBe('A');
        });

        test('ignores memberships through the national organization or of another period', () => {
            const registrations = [
                registration(groupA, current, { registeredAt: '2025-09-15T00:00:00Z' }),
                registration(groupB, current, { registeredAt: '2025-10-15T00:00:00Z' }),
            ];
            expect(getPrimaryOrganizationUri(registrations, [
                membership(national, current, fullType),
                membership(groupA, previous, fullType),
            ])).toBe('B');
        });

        test('without memberships prefers a default age group, then the latest registration', () => {
            expect(getPrimaryOrganizationUri([
                registration(groupA, current, { registeredAt: '2025-09-15T00:00:00Z', defaultAgeGroup: true }),
                registration(groupB, current, { registeredAt: '2025-10-15T00:00:00Z' }),
            ])).toBe('A');
            expect(getPrimaryOrganizationUri([
                registration(groupA, current, { registeredAt: '2025-09-15T00:00:00Z', defaultAgeGroup: true }),
                registration(groupB, current, { registeredAt: '2025-10-15T00:00:00Z', defaultAgeGroup: true }),
            ])).toBe('B');
        });

        test('goes back one period at a time and ignores later periods', () => {
            const registrations = [
                registration(groupA, previous, { registeredAt: '2024-09-15T00:00:00Z' }),
                registration(groupB, twoYearsAgo, { registeredAt: '2023-09-15T00:00:00Z', defaultAgeGroup: true }),
                registration(groupB, next, { registeredAt: '2025-08-01T00:00:00Z', defaultAgeGroup: true }),
                registration(national, current),
            ];
            expect(getPrimaryOrganizationUri(registrations)).toBe('A');
            expect(getPrimaryOrganizationUri(registrations, [], twoYearsAgo.id)).toBe('B');
            expect(getPrimaryOrganizationUri([registration(groupB, next)])).toBe(null);
        });

        test('uses the start date of an organization period that is not the platform period', () => {
            const organizationPeriod = RegistrationPeriod.create({ startDate: new Date('2024-01-01T00:00:00Z'), endDate: new Date('2024-12-31T00:00:00Z') });
            const blob = MembersBlob.create({
                organizations: [groupA, groupB],
                members: [MemberWithRegistrationsBlob.create({ details: MemberDetails.create({}), registrations: [registration(groupA, twoYearsAgo), registration(groupB, previous)] })],
            });
            const family = PlatformFamily.create(blob, { platform, contextOrganization: Organization.create({ period: OrganizationRegistrationPeriod.create({ period: organizationPeriod }) }) });
            expect(family.members[0].getPrimaryOrganization({ periodId: organizationPeriod.id })?.uri).toBe('A');
        });

        test('does not search other periods when the start of the requested period is unknown', () => {
            expect(getPrimaryOrganizationUri([registration(groupA, previous)], [], 'unknown-period')).toBe(null);
        });

        test('ignores earlier registrations of groups without a known period', () => {
            const withoutPeriod = registration(groupA, previous);
            withoutPeriod.group.settings.period = null;
            expect(getPrimaryOrganizationUri([withoutPeriod])).toBe(null);
        });

        test('counts a membership of a removed type as a full membership', () => {
            const removedType = PlatformMembershipType.create({});
            expect(getPrimaryOrganizationUri([
                registration(groupA, current, { registeredAt: '2025-10-15T00:00:00Z' }),
                registration(groupB, current, { registeredAt: '2025-09-15T00:00:00Z' }),
            ], [
                membership(groupA, current, temporaryType),
                membership(groupB, current, removedType),
            ])).toBe('B');
        });

        test('ignores waiting lists, deactivated registrations and events', () => {
            expect(getPrimaryOrganizationUri([
                registration(groupA, previous, { registeredAt: '2024-09-15T00:00:00Z' }),
                registration(groupB, current, { waitingList: true }),
                registration(groupB, current, { deactivated: true }),
                registration(groupB, current, { type: GroupType.EventRegistration }),
            ])).toBe('A');
        });

        test('returns the fixed organization of a member outside platform mode', () => {
            const blob = MembersBlob.create({
                organizations: [groupA, groupB],
                members: [MemberWithRegistrationsBlob.create({ details: MemberDetails.create({}), organizationId: groupA.id, registrations: [registration(groupB, current)] })],
            });
            const family = PlatformFamily.create(blob, { platform });
            expect(family.members[0].getPrimaryOrganization({ periodId: current.id })?.uri).toBe('A');
        });
    });
});
