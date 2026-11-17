import { SGVSyncStatus } from '@stamhoofd/components/members/sgvSync';
import {
    Group,
    GroupPrice,
    GroupType,
    MemberDetails,
    MemberWithRegistrationsBlob,
    Organization,
    OrganizationRegistrationPeriod,
    Registration,
    RegistrationPeriod,
} from '@stamhoofd/structures';
import { getSGVGroups, getSGVSyncStatus, isOnlyInSGVTrial, splitSGVTrialMembers } from './SGVMemberStatus.ts';

describe('SGVMemberStatus', () => {
    const now = new Date(2026, 5, 1, 12);

    function createGroup(type = GroupType.Membership, periodId = 'period-id', id = type) {
        return Group.create({
            id,
            type,
            periodId,
        });
    }

    function createOrganization(periodId = 'period-id') {
        return Organization.create({
            period: OrganizationRegistrationPeriod.create({
                period: RegistrationPeriod.create({ id: periodId }),
            }),
        });
    }

    function createMember({
        lastExternalSync = new Date(now.getTime() - 1000 * 60),
        updatedAt = lastExternalSync ?? now,
        registeredAt = new Date(now.getTime() - 1000 * 60 * 2),
        group = createGroup(),
        trialUntil = null,
    }: {
        lastExternalSync?: Date | null;
        updatedAt?: Date;
        registeredAt?: Date | null;
        group?: Group;
        trialUntil?: Date | null;
    } = {}) {
        return MemberWithRegistrationsBlob.create({
            updatedAt,
            details: MemberDetails.create({
                lastExternalSync,
            }),
            registrations: [
                Registration.create({
                    group,
                    groupPrice: GroupPrice.create({}),
                    registeredAt,
                    deactivatedAt: null,
                    trialUntil,
                }),
            ],
        });
    }

    test('splits members that are only in their trial period from members that are synced', () => {
        const trialMember = createMember({ trialUntil: new Date(now.getTime() + 1000 * 60 * 60 * 24) });
        const endedTrialMember = createMember({ trialUntil: new Date(now.getTime() - 1000) });
        const regularMember = createMember();

        const { syncMembers, trialMembers } = splitSGVTrialMembers(
            [trialMember, endedTrialMember, regularMember],
            createOrganization(),
            now,
        );

        expect(syncMembers).toEqual([endedTrialMember, regularMember]);
        expect(trialMembers).toEqual([trialMember]);
    });

    test('returns never without last external sync', () => {
        const member = createMember({ lastExternalSync: null });
        expect(getSGVSyncStatus(member, { now, organization: createOrganization() })).toBe(
            SGVSyncStatus.Never,
        );
    });

    test('returns outdated when a current registration is newer than the last sync', () => {
        const member = createMember({
            lastExternalSync: new Date(now.getTime() - 1000 * 60 * 2),
            registeredAt: new Date(now.getTime() - 1000 * 60),
        });

        expect(getSGVSyncStatus(member, { now, organization: createOrganization() })).toBe(
            SGVSyncStatus.Outdated,
        );
    });

    test('returns outdated when the last sync is older than nine months', () => {
        const lastExternalSync = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30 * 10);
        const member = createMember({
            lastExternalSync,
            updatedAt: lastExternalSync,
            registeredAt: new Date(lastExternalSync.getTime() - 1000),
        });

        expect(getSGVSyncStatus(member, { now, organization: createOrganization() })).toBe(
            SGVSyncStatus.Outdated,
        );
    });

    test('returns ok when the member update time is close to the last sync', () => {
        const lastExternalSync = new Date(now.getTime() - 1000 * 60);
        const member = createMember({
            lastExternalSync,
            updatedAt: new Date(lastExternalSync.getTime() + 1000),
        });

        expect(getSGVSyncStatus(member, { now, organization: createOrganization() })).toBe(
            SGVSyncStatus.Ok,
        );
    });

    test('returns changed when member details changed after the last sync', () => {
        const lastExternalSync = new Date(now.getTime() - 1000 * 60);
        const member = createMember({
            lastExternalSync,
            updatedAt: new Date(lastExternalSync.getTime() + 1000 * 60),
        });

        expect(getSGVSyncStatus(member, { now, organization: createOrganization() })).toBe(
            SGVSyncStatus.Changed,
        );
    });

    test('ignores registrations from periods other than the organization default period', () => {
        const member = createMember({
            lastExternalSync: new Date(now.getTime() - 1000 * 60 * 2),
            registeredAt: new Date(now.getTime() - 1000 * 60),
            group: createGroup(GroupType.Membership, 'other-period'),
        });

        expect(
            getSGVSyncStatus(member, { now, organization: createOrganization('period-id') }),
        ).toBe(SGVSyncStatus.Ok);
        expect(
            getSGVSyncStatus(member, { now, organization: createOrganization('other-period') }),
        ).toBe(SGVSyncStatus.Outdated);
    });

    test('returns ok when registrations only exist in another period', () => {
        const member = createMember({
            lastExternalSync: null,
            group: createGroup(GroupType.Membership, 'other-period'),
        });

        expect(
            getSGVSyncStatus(member, { now, organization: createOrganization('period-id') }),
        ).toBe(SGVSyncStatus.Ok);
    });

    test('returns ok for members that are only on a waiting list or registered for an event', () => {
        for (const type of [GroupType.WaitingList, GroupType.EventRegistration]) {
            const member = createMember({
                lastExternalSync: null,
                group: createGroup(type),
            });

            expect(getSGVSyncStatus(member, { now, organization: createOrganization() })).toBe(
                SGVSyncStatus.Ok,
            );
        }
    });

    test('returns ok for members that are only registered with a running trial period', () => {
        const member = createMember({
            lastExternalSync: null,
            trialUntil: new Date(now.getTime() + 1000 * 60 * 60 * 24),
        });

        expect(getSGVSyncStatus(member, { now, organization: createOrganization() })).toBe(
            SGVSyncStatus.Ok,
        );
    });

    test('returns ok for members that stopped during their trial period', () => {
        const member = createMember({
            lastExternalSync: null,
            trialUntil: new Date(now.getTime() - 1000),
        });
        member.registrations[0].deactivatedAt = new Date(now.getTime() - 1000 * 60);

        expect(getSGVSyncStatus(member, { now, organization: createOrganization() })).toBe(
            SGVSyncStatus.Ok,
        );
    });

    test('returns never once the trial period of a member that was never synced has ended', () => {
        const member = createMember({
            lastExternalSync: null,
            trialUntil: new Date(now.getTime() - 1000),
        });

        expect(getSGVSyncStatus(member, { now, organization: createOrganization() })).toBe(
            SGVSyncStatus.Never,
        );
    });

    test('marks members as outdated when their trial period ended after the last sync', () => {
        const lastExternalSync = new Date(now.getTime() - 1000 * 60);
        const member = createMember({
            lastExternalSync,
            updatedAt: lastExternalSync,
            registeredAt: new Date(lastExternalSync.getTime() - 1000 * 60),
            trialUntil: new Date(now.getTime() - 1000),
        });

        expect(getSGVSyncStatus(member, { now, organization: createOrganization() })).toBe(
            SGVSyncStatus.Outdated,
        );
    });

    test('excludes groups of registrations in a running trial period', () => {
        const member = createMember({
            trialUntil: new Date(now.getTime() + 1000 * 60 * 60 * 24),
        });
        const organization = createOrganization();

        expect(getSGVGroups(member, organization, now)).toEqual([]);
        expect(isOnlyInSGVTrial(member, organization, now)).toBe(true);

        member.registrations.push(
            Registration.create({
                group: Group.create({
                    id: 'other-group',
                    type: GroupType.Membership,
                    periodId: 'period-id',
                }),
                groupPrice: GroupPrice.create({}),
                registeredAt: now,
                deactivatedAt: null,
            }),
        );

        expect(getSGVGroups(member, organization, now).map(group => group.id)).toEqual(['other-group']);
        expect(isOnlyInSGVTrial(member, organization, now)).toBe(false);
    });

    test('returns ok for synced members that also have a registration in a running trial period', () => {
        const lastExternalSync = new Date(now.getTime() - 1000 * 60);
        const member = createMember({ lastExternalSync, updatedAt: lastExternalSync });
        member.registrations.push(
            Registration.create({
                group: Group.create({
                    id: 'trial-group',
                    type: GroupType.Membership,
                    periodId: 'period-id',
                }),
                groupPrice: GroupPrice.create({}),
                registeredAt: new Date(now.getTime() - 1000),
                deactivatedAt: null,
                trialUntil: new Date(now.getTime() + 1000 * 60 * 60 * 24),
            }),
        );

        expect(getSGVSyncStatus(member, { now, organization: createOrganization() })).toBe(
            SGVSyncStatus.Ok,
        );
    });

    test('includes groups once the trial period has ended', () => {
        const member = createMember({
            trialUntil: new Date(now.getTime() - 1000),
        });
        const organization = createOrganization();

        expect(getSGVGroups(member, organization, now).map(group => group.id)).toEqual([
            GroupType.Membership,
        ]);
        expect(isOnlyInSGVTrial(member, organization, now)).toBe(false);
    });

    test('ignores deactivated registrations when determining outdated status', () => {
        const lastExternalSync = new Date(now.getTime() - 1000 * 60 * 2);
        const member = createMember({
            lastExternalSync,
            updatedAt: lastExternalSync,
            registeredAt: new Date(now.getTime() - 1000 * 60),
        });
        member.registrations[0].deactivatedAt = now;

        expect(getSGVSyncStatus(member, { now, organization: createOrganization() })).toBe(
            SGVSyncStatus.Ok,
        );
    });

    test('does not mark registrations at the exact sync time as outdated', () => {
        const lastExternalSync = new Date(now.getTime() - 1000 * 60);
        const member = createMember({
            lastExternalSync,
            updatedAt: lastExternalSync,
            registeredAt: lastExternalSync,
        });

        expect(getSGVSyncStatus(member, { now, organization: createOrganization() })).toBe(
            SGVSyncStatus.Ok,
        );
    });

    test('uses the update tolerance around the last sync time', () => {
        const lastExternalSync = new Date(now.getTime() - 1000 * 60);

        expect(
            getSGVSyncStatus(
                createMember({
                    lastExternalSync,
                    updatedAt: new Date(lastExternalSync.getTime() + 1000 * 5 - 1),
                }), { now, organization: createOrganization() }),
        ).toBe(SGVSyncStatus.Ok);

        expect(
            getSGVSyncStatus(
                createMember({
                    lastExternalSync,
                    updatedAt: new Date(lastExternalSync.getTime() + 1000 * 5),
                }), { now, organization: createOrganization() }),
        ).toBe(SGVSyncStatus.Changed);
    });

    test('marks syncs older than nine months as outdated', () => {
        const nineMonths = 1000 * 60 * 60 * 24 * 30 * 9;
        const justRecentEnough = new Date(now.getTime() - nineMonths);
        const tooOld = new Date(now.getTime() - nineMonths - 1);

        expect(
            getSGVSyncStatus(
                createMember({
                    lastExternalSync: justRecentEnough,
                    updatedAt: justRecentEnough,
                    registeredAt: new Date(justRecentEnough.getTime() - 1000),
                }), { now, organization: createOrganization() }),
        ).toBe(SGVSyncStatus.Ok);

        expect(
            getSGVSyncStatus(
                createMember({
                    lastExternalSync: tooOld,
                    updatedAt: tooOld,
                    registeredAt: new Date(tooOld.getTime() - 1000),
                }), { now, organization: createOrganization() }),
        ).toBe(SGVSyncStatus.Outdated);
    });
});
