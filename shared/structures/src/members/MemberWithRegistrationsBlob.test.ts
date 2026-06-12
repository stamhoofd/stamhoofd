import { Group } from '../Group.js';
import { GroupPrice } from '../GroupSettings.js';
import { GroupType } from '../GroupType.js';
import { MemberDetails } from './MemberDetails.js';
import { MemberWithRegistrationsBlob, SGVSyncStatus } from './MemberWithRegistrationsBlob.js';
import { Registration } from './Registration.js';

describe('MemberWithRegistrationsBlob SGV sync helpers', () => {
    const now = new Date(2026, 5, 1, 12);

    function createGroup(type = GroupType.Membership, periodId = 'period-id', id = type) {
        return Group.create({
            id,
            type,
            periodId,
        });
    }

    function createMember({
        lastExternalSync = new Date(now.getTime() - 1000 * 60),
        updatedAt = lastExternalSync ?? now,
        registeredAt = new Date(now.getTime() - 1000 * 60 * 2),
        group = createGroup(),
    }: {
        lastExternalSync?: Date | null;
        updatedAt?: Date;
        registeredAt?: Date | null;
        group?: Group;
    } = {}) {
        return MemberWithRegistrationsBlob.create({
            updatedAt,
            details: MemberDetails.create({
                lastExternalSync,
            }),
            registrations: [Registration.create({
                group,
                groupPrice: GroupPrice.create({}),
                registeredAt,
                deactivatedAt: null,
            })],
        });
    }

    test('returns never without last external sync', () => {
        const member = createMember({ lastExternalSync: null });
        expect(member.getSGVSyncStatus({ now })).toBe(SGVSyncStatus.Never);
    });

    test('returns outdated when a current registration is newer than the last sync', () => {
        const member = createMember({
            lastExternalSync: new Date(now.getTime() - 1000 * 60 * 2),
            registeredAt: new Date(now.getTime() - 1000 * 60),
        });

        expect(member.getSGVSyncStatus({ now })).toBe(SGVSyncStatus.Outdated);
    });

    test('returns outdated when the last sync is older than nine months', () => {
        const lastExternalSync = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30 * 10);
        const member = createMember({
            lastExternalSync,
            updatedAt: lastExternalSync,
            registeredAt: new Date(lastExternalSync.getTime() - 1000),
        });

        expect(member.getSGVSyncStatus({ now })).toBe(SGVSyncStatus.Outdated);
    });

    test('returns ok when the member update time is close to the last sync', () => {
        const lastExternalSync = new Date(now.getTime() - 1000 * 60);
        const member = createMember({
            lastExternalSync,
            updatedAt: new Date(lastExternalSync.getTime() + 1000),
        });

        expect(member.getSGVSyncStatus({ now })).toBe(SGVSyncStatus.Ok);
    });

    test('returns changed when member details changed after the last sync', () => {
        const lastExternalSync = new Date(now.getTime() - 1000 * 60);
        const member = createMember({
            lastExternalSync,
            updatedAt: new Date(lastExternalSync.getTime() + 1000 * 60),
        });

        expect(member.getSGVSyncStatus({ now })).toBe(SGVSyncStatus.Changed);
    });

    test('ignores registrations from other periods when a period id is provided', () => {
        const member = createMember({
            lastExternalSync: new Date(now.getTime() - 1000 * 60 * 2),
            registeredAt: new Date(now.getTime() - 1000 * 60),
            group: createGroup(GroupType.Membership, 'other-period'),
        });

        expect(member.getSGVSyncStatus({ now, periodId: 'period-id' })).toBe(SGVSyncStatus.Ok);
        expect(member.getSGVSyncStatus({ now, periodId: 'other-period' })).toBe(SGVSyncStatus.Outdated);
    });

    test('ignores deactivated registrations when determining outdated status', () => {
        const lastExternalSync = new Date(now.getTime() - 1000 * 60 * 2);
        const member = createMember({
            lastExternalSync,
            updatedAt: lastExternalSync,
            registeredAt: new Date(now.getTime() - 1000 * 60),
        });
        member.registrations[0].deactivatedAt = now;

        expect(member.getSGVSyncStatus({ now })).toBe(SGVSyncStatus.Ok);
    });

    test('does not mark registrations at the exact sync time as outdated', () => {
        const lastExternalSync = new Date(now.getTime() - 1000 * 60);
        const member = createMember({
            lastExternalSync,
            updatedAt: lastExternalSync,
            registeredAt: lastExternalSync,
        });

        expect(member.getSGVSyncStatus({ now })).toBe(SGVSyncStatus.Ok);
    });

    test('uses the update tolerance around the last sync time', () => {
        const lastExternalSync = new Date(now.getTime() - 1000 * 60);

        expect(createMember({
            lastExternalSync,
            updatedAt: new Date(lastExternalSync.getTime() + 1000 * 5 - 1),
        }).getSGVSyncStatus({ now })).toBe(SGVSyncStatus.Ok);

        expect(createMember({
            lastExternalSync,
            updatedAt: new Date(lastExternalSync.getTime() + 1000 * 5),
        }).getSGVSyncStatus({ now })).toBe(SGVSyncStatus.Changed);
    });

    test('marks syncs older than nine months as outdated', () => {
        const nineMonths = 1000 * 60 * 60 * 24 * 30 * 9;
        const justRecentEnough = new Date(now.getTime() - nineMonths);
        const tooOld = new Date(now.getTime() - nineMonths - 1);

        expect(createMember({
            lastExternalSync: justRecentEnough,
            updatedAt: justRecentEnough,
            registeredAt: new Date(justRecentEnough.getTime() - 1000),
        }).getSGVSyncStatus({ now })).toBe(SGVSyncStatus.Ok);

        expect(createMember({
            lastExternalSync: tooOld,
            updatedAt: tooOld,
            registeredAt: new Date(tooOld.getTime() - 1000),
        }).getSGVSyncStatus({ now })).toBe(SGVSyncStatus.Outdated);
    });

});
