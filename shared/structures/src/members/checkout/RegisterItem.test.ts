import { Group } from '../../Group.js';
import { GroupSettings } from '../../GroupSettings.js';
import { GroupType } from '../../GroupType.js';
import { Organization } from '../../Organization.js';
import { Platform } from '../../Platform.js';
import { OrganizationRegistrationPeriod, RegistrationPeriod } from '../../RegistrationPeriod.js';
import { MemberDetails } from '../MemberDetails.js';
import { MembersBlob, MemberWithRegistrationsBlob } from '../MemberWithRegistrationsBlob.js';
import { PlatformFamily } from '../PlatformMember.js';
import { Registration } from '../Registration.js';
import { RegisterItem } from './RegisterItem.js';

describe('Unit.RegisterItem', () => {
    it('group without restrictions should be valid', () => {
        const blob = MembersBlob.create({
            members: [
                MemberWithRegistrationsBlob.create({
                    details: MemberDetails.create({
                        firstName: 'John',
                        lastName: 'Doe',
                    }),
                }),
            ],
        });
        const period = RegistrationPeriod.create({});
        const organization = Organization.create({
            period: OrganizationRegistrationPeriod.create({
                period,
            }),
        });
        const group = Group.create({
            organizationId: organization.id,
            periodId: period.id,
        });
        const family = PlatformFamily.create(blob, { platform: Platform.create({}) });
        const member = family.members[0];
        const item = RegisterItem.defaultFor(member, group, organization);

        expect(() => item.validate()).not.toThrow();
    });

    describe('requireDefaultAgeGroupIds', () => {
        it('should be invalid if no registrations', () => {
            const blob = MembersBlob.create({
                members: [
                    MemberWithRegistrationsBlob.create({
                        details: MemberDetails.create({
                            firstName: 'John',
                            lastName: 'Doe',
                        }),
                    }),
                ],
            });
            const period = RegistrationPeriod.create({});
            const organization = Organization.create({
                period: OrganizationRegistrationPeriod.create({
                    period,
                }),
            });
            const group = Group.create({
                organizationId: organization.id,
                periodId: period.id,
                settings: GroupSettings.create({
                    requireDefaultAgeGroupIds: ['default-age-group'],
                }),
            });
            const family = PlatformFamily.create(blob, { platform: Platform.create({}) });
            const member = family.members[0];
            const item = RegisterItem.defaultFor(member, group, organization);

            expect(() => item.validate()).toThrow('Not matching: requireDefaultAgeGroupIds');
        });

        it('should be valid if it has default age group registration', () => {
            const period = RegistrationPeriod.create({});
            const organization = Organization.create({
                period: OrganizationRegistrationPeriod.create({
                    period,
                }),
            });
            const defaultAgeGroup = Group.create({
                organizationId: organization.id,
                periodId: period.id,
                defaultAgeGroupId: 'default-age-group',
            });

            const blob = MembersBlob.create({
                members: [
                    MemberWithRegistrationsBlob.create({
                        details: MemberDetails.create({
                            firstName: 'John',
                            lastName: 'Doe',
                        }),
                        registrations: [
                            Registration.create({
                                organizationId: organization.id,
                                group: defaultAgeGroup,
                                groupPrice: defaultAgeGroup.settings.prices[0],
                                registeredAt: new Date(),
                            }),
                        ],
                    }),
                ],
            });
            const group = Group.create({
                organizationId: organization.id,
                periodId: period.id,
                settings: GroupSettings.create({
                    requireDefaultAgeGroupIds: ['default-age-group'],
                }),
            });
            const family = PlatformFamily.create(blob, { platform: Platform.create({}) });
            const member = family.members[0];
            const item = RegisterItem.defaultFor(member, group, organization);

            expect(() => item.validate()).not.toThrow();
        });

        it('should be invalid if registration was previous period', () => {
            const period = RegistrationPeriod.create({});
            const previousPeriod = RegistrationPeriod.create({});
            const organization = Organization.create({
                period: OrganizationRegistrationPeriod.create({
                    period,
                }),
            });
            const defaultAgeGroup = Group.create({
                organizationId: organization.id,
                periodId: previousPeriod.id,
                defaultAgeGroupId: 'default-age-group',
            });

            const blob = MembersBlob.create({
                members: [
                    MemberWithRegistrationsBlob.create({
                        details: MemberDetails.create({
                            firstName: 'John',
                            lastName: 'Doe',
                        }),
                        registrations: [
                            Registration.create({
                                organizationId: organization.id,
                                group: defaultAgeGroup,
                                groupPrice: defaultAgeGroup.settings.prices[0],
                                registeredAt: new Date(),
                            }),
                        ],
                    }),
                ],
            });
            const group = Group.create({
                organizationId: organization.id,
                periodId: period.id,
                settings: GroupSettings.create({
                    requireDefaultAgeGroupIds: ['default-age-group'],
                }),
            });
            const family = PlatformFamily.create(blob, { platform: Platform.create({}) });
            const member = family.members[0];
            const item = RegisterItem.defaultFor(member, group, organization);

            expect(() => item.validate()).toThrow('Not matching: requireDefaultAgeGroupIds');
        });

        it('should be valid if registration is different period but it is the active period', () => {
            const period = RegistrationPeriod.create({});
            const previousPeriod = RegistrationPeriod.create({});
            const organization = Organization.create({
                period: OrganizationRegistrationPeriod.create({
                    period: previousPeriod, // This is the active period
                }),
            });
            const platform = Platform.create({
                period: previousPeriod, // This is the active period
            });
            const defaultAgeGroup = Group.create({
                organizationId: organization.id,
                periodId: previousPeriod.id,
                defaultAgeGroupId: 'default-age-group',
            });

            const blob = MembersBlob.create({
                members: [
                    MemberWithRegistrationsBlob.create({
                        details: MemberDetails.create({
                            firstName: 'John',
                            lastName: 'Doe',
                        }),
                        registrations: [
                            Registration.create({
                                organizationId: organization.id,
                                group: defaultAgeGroup,
                                groupPrice: defaultAgeGroup.settings.prices[0],
                                registeredAt: new Date(),
                            }),
                        ],
                    }),
                ],
            });
            const group = Group.create({
                type: GroupType.EventRegistration,
                organizationId: organization.id,
                periodId: period.id, // This is already on the next period
                settings: GroupSettings.create({
                    requireDefaultAgeGroupIds: ['default-age-group'],
                    period: period, // This cache is required to know whether the group should be locked or not
                }),
            });
            const family = PlatformFamily.create(blob, { platform });
            const member = family.members[0];
            const item = RegisterItem.defaultFor(member, group, organization);

            expect(() => item.validate()).not.toThrow();
        });
    });

    describe('periods', () => {
        it('cannot register for a locked period', () => {
            const period = RegistrationPeriod.create({
                locked: true,
            });
            const organization = Organization.create({
                period: OrganizationRegistrationPeriod.create({
                    period,
                }),
            });
            const platform = Platform.create({
                period,
            });
            const blob = MembersBlob.create({
                members: [
                    MemberWithRegistrationsBlob.create({
                        details: MemberDetails.create({
                            firstName: 'John',
                            lastName: 'Doe',
                        }),
                        registrations: [],
                    }),
                ],
            });
            const group = Group.create({
                type: GroupType.EventRegistration,
                organizationId: organization.id,
                periodId: period.id, // This is already on the next period
                settings: GroupSettings.create({
                    period: period, // This cache is required to know whether the group should be locked or not
                }),
            });
            const family = PlatformFamily.create(blob, { platform });
            const member = family.members[0];
            const item = RegisterItem.defaultFor(member, group, organization);

            expect(() => item.validate()).toThrow('Locked period');
        });

        it('can register for a future unlocked period if not a membership group', () => {
            const period = RegistrationPeriod.create({
                locked: true,
            });
            const futurePeriod = RegistrationPeriod.create({});
            const organization = Organization.create({
                period: OrganizationRegistrationPeriod.create({
                    period,
                }),
            });
            const platform = Platform.create({
                period,
            });
            const blob = MembersBlob.create({
                members: [
                    MemberWithRegistrationsBlob.create({
                        details: MemberDetails.create({
                            firstName: 'John',
                            lastName: 'Doe',
                        }),
                        registrations: [],
                    }),
                ],
            });
            const group = Group.create({
                type: GroupType.EventRegistration,
                organizationId: organization.id,
                periodId: futurePeriod.id, // This is already on the next period
                settings: GroupSettings.create({
                    period: futurePeriod, // This cache is required to know whether the group should be locked or not
                }),
            });
            const family = PlatformFamily.create(blob, { platform });
            const member = family.members[0];
            const item = RegisterItem.defaultFor(member, group, organization);

            expect(() => item.validate()).not.toThrow();
        });

        it('cannot register for a future locked period if not a membership group', () => {
            const period = RegistrationPeriod.create({
                locked: true,
            });
            const futurePeriod = RegistrationPeriod.create({
                locked: true,
            });
            const organization = Organization.create({
                period: OrganizationRegistrationPeriod.create({
                    period,
                }),
            });
            const platform = Platform.create({
                period,
            });
            const blob = MembersBlob.create({
                members: [
                    MemberWithRegistrationsBlob.create({
                        details: MemberDetails.create({
                            firstName: 'John',
                            lastName: 'Doe',
                        }),
                        registrations: [],
                    }),
                ],
            });
            const group = Group.create({
                type: GroupType.EventRegistration,
                organizationId: organization.id,
                periodId: futurePeriod.id, // This is already on the next period
                settings: GroupSettings.create({
                    period: futurePeriod, // This cache is required to know whether the group should be locked or not
                }),
            });
            const family = PlatformFamily.create(blob, { platform });
            const member = family.members[0];
            const item = RegisterItem.defaultFor(member, group, organization);

            expect(() => item.validate()).toThrow('Locked period');
        });

        it('cannot register for a future unlocked period if a membership group', () => {
            const period = RegistrationPeriod.create({
                locked: true,
            });
            const futurePeriod = RegistrationPeriod.create({});
            const organization = Organization.create({
                period: OrganizationRegistrationPeriod.create({
                    period,
                }),
            });
            const platform = Platform.create({
                period,
            });
            const blob = MembersBlob.create({
                members: [
                    MemberWithRegistrationsBlob.create({
                        details: MemberDetails.create({
                            firstName: 'John',
                            lastName: 'Doe',
                        }),
                        registrations: [],
                    }),
                ],
            });
            const group = Group.create({
                type: GroupType.Membership,
                organizationId: organization.id,
                periodId: futurePeriod.id, // This is already on the next period
                settings: GroupSettings.create({
                    period: futurePeriod, // This cache is required to know whether the group should be locked or not
                }),
            });
            const family = PlatformFamily.create(blob, { platform });
            const member = family.members[0];
            const item = RegisterItem.defaultFor(member, group, organization);

            expect(() => item.validate()).toThrow('Different period');
        });
    });
});
