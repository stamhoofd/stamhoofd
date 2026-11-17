import { SGVSyncStatus } from '@stamhoofd/components/members/sgvSync';
import type { Group, MemberWithRegistrationsBlob, Organization, Registration } from '@stamhoofd/structures';
import { GroupType } from '@stamhoofd/structures';

const SGV_OUTDATED_AFTER_MS = 1000 * 60 * 60 * 24 * 30 * 9; // 9 months
const SGV_SYNC_UPDATE_TOLERANCE_MS = 1000 * 5; // 5 seconds

function getActiveMembershipRegistrations(member: MemberWithRegistrationsBlob, organization: Organization): Registration[] {
    return member.registrations.filter(
        registration =>
            registration.registeredAt !== null
            && registration.deactivatedAt === null
            && registration.group.type === GroupType.Membership
            && registration.group.periodId === organization.period.period.id,
    );
}

/**
 * Groups that are synced with the SGV groepsadministratie.
 * Registrations in their trial period are excluded: the group would pay a membership fee
 * for members who might stop after the trial.
 */
export function getSGVGroups(member: MemberWithRegistrationsBlob, organization: Organization): Group[] {
    return getActiveMembershipRegistrations(member, organization)
        .filter(registration => !registration.isTrial)
        .map(registration => registration.group);
}

/**
 * True when the member has active membership registrations in the current period, but all of them are still in their trial period.
 * These members are not synced with the SGV groepsadministratie until the trial ends.
 */
export function isOnlyInSGVTrial(member: MemberWithRegistrationsBlob, organization: Organization, now = new Date()): boolean {
    const registrations = getActiveMembershipRegistrations(member, organization);
    return registrations.length > 0 && registrations.every(registration => registration.isTrialAt(now));
}

/**
 * Splits the members into members that are synced with the SGV groepsadministratie
 * and members that are skipped because they are still in their trial period.
 */
export function splitSGVTrialMembers(members: MemberWithRegistrationsBlob[], organization: Organization, now = new Date()): {
    syncMembers: MemberWithRegistrationsBlob[];
    trialMembers: MemberWithRegistrationsBlob[];
} {
    const syncMembers: MemberWithRegistrationsBlob[] = [];
    const trialMembers: MemberWithRegistrationsBlob[] = [];
    for (const member of members) {
        if (isOnlyInSGVTrial(member, organization, now)) {
            trialMembers.push(member);
        } else {
            syncMembers.push(member);
        }
    }
    return { syncMembers, trialMembers };
}

/**
 * Determines whether a member still reflects the latest SGV sync.
 * New membership registrations, ended trial periods and old sync timestamps become outdated, while local edits after sync become changed.
 */
export function getSGVSyncStatus(member: MemberWithRegistrationsBlob, options: { organization: Organization; now?: Date }): SGVSyncStatus {
    const now = options.now ?? new Date();
    const activeRegistrations = member.registrations.filter(
        registration =>
            registration.group.periodId === options.organization.period.period.id
            && registration.group.type === GroupType.Membership
            && !registration.isTrialAt(now),
    );

    if (activeRegistrations.length === 0) {
        return SGVSyncStatus.Ok;
    }

    const lastExternalSync = member.details.lastExternalSync;
    if (!lastExternalSync) {
        return SGVSyncStatus.Never;
    }

    for (const registration of activeRegistrations) {
        if (registration.deactivatedAt !== null || registration.registeredAt === null) {
            continue;
        }

        // A registration only counts for SGV once its trial period has ended
        const countsSince = registration.trialUntil && registration.trialUntil > registration.registeredAt
            ? registration.trialUntil
            : registration.registeredAt;

        if (countsSince > lastExternalSync) {
            return SGVSyncStatus.Outdated;
        }
    }

    if (lastExternalSync.getTime() < now.getTime() - SGV_OUTDATED_AFTER_MS) {
        return SGVSyncStatus.Outdated;
    }

    if (Math.abs(lastExternalSync.getTime() - member.updatedAt.getTime()) < SGV_SYNC_UPDATE_TOLERANCE_MS) {
        return SGVSyncStatus.Ok;
    }

    return SGVSyncStatus.Changed;
}
