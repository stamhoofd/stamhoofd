import { SessionContext } from '@stamhoofd/networking';
import { MembersBlob, OrganizationRegistrationPeriod } from '@stamhoofd/structures';

/**
 * Call this method when we receive a fresh blob from the backend.
 * It will search in the blob for interesting up-to-date information that could be used to refresh parts of our session context.
 */
export function updateContextFromMembersBlob(context: SessionContext, blob: MembersBlob) {
    const user = context.auth.user;
    if (user) {
        // Update the user if we received a blob that contains a member with a user id equal to ours - while we don't have the memberId locally set
        const userId = user.id;
        const userMemberId = user.memberId;

        const foundUser = blob.members
            .flatMap(cm => cm.users)
            .find(u => u.id === userId);

        if (foundUser) {
            // We did patch a member we 'own'
            const newUserMemberId = foundUser.memberId ?? null;

            // Update user blob
            user.members = blob;

            if (userMemberId !== newUserMemberId) {
                // The user has been associated with a different member, we need to update our session data
                // permissions might have changed
                context.updateData(true, false, false).catch(console.error);
            }
        }
    }

    // Update organizations we received
    // this updates the group cached counts
    if (context.organization) {
        const id = context.organization.id;

        // Skip this if we received a fresh organization in the response
        const fresh = blob.organizations.find(o => o.id === id);
        if (fresh) {
            // Only deep set if we don't lose any private meta
            context.updateOrganization(fresh);
            return;
        }

        const members = blob.members;

        // Update group data we received
        const processedGroups = new Set<string>();
        for (const member of members) {
            for (const registration of member.registrations) {
                if (registration.organizationId === context.organization.id && !processedGroups.has(registration.groupId)) {
                    const periodId = registration.group.periodId;
                    let period: OrganizationRegistrationPeriod | undefined = context.organization.period;

                    if (context.organization.period.period.id !== periodId) {
                        period = context.organization.periods?.organizationPeriods.find(p => p.period.id === periodId);
                    }

                    const originalGroup = period?.groups.find(g => g.id === registration.groupId) ?? period?.waitingLists.find(g => g.id === registration.groupId);
                    if (originalGroup) {
                        const waitingList = originalGroup.waitingList;
                        originalGroup.deepSet(registration.group);
                        if (!originalGroup.waitingList && waitingList) {
                            // The backend not always returns the waiting list in deeper requests.
                            originalGroup.waitingList = waitingList;
                        }
                    }
                    processedGroups.add(registration.groupId);
                }
            }
        }
    }
}
