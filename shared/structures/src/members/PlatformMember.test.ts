import 'jest-extended';
import { MemberWithRegistrationsBlob } from './MemberWithRegistrationsBlob.js';
import { MemberPlatformMembership } from './MemberPlatformMembership.js';
import { Platform } from '../Platform.js';
import { Organization } from '../Organization.js';
import { MemberDetails } from './MemberDetails.js';
import { ContinuousMembershipStatus } from './MembershipStatus.js';
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
});
