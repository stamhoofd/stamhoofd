import { Group } from '@stamhoofd/models';
import type { StamhoofdFilter, StamhoofdKeyFilter } from '@stamhoofd/structures';
import { GroupStatus, GroupType, PermissionLevel } from '@stamhoofd/structures';
import { Context } from '../../../../helpers/Context.js';

/**
 * Filter that limits members to the ones the current user can access, for endpoints that cannot rely
 * on the caller having access to every member. Returns undefined when no scoping is needed.
 */
export async function getMemberScopeFilter(permissionLevel: PermissionLevel = PermissionLevel.Read): Promise<StamhoofdFilter | undefined> {
    const organization = Context.organization;

    if (!organization) {
        const tags = Context.auth.getPlatformAccessibleOrganizationTags(permissionLevel);
        if (tags !== 'all' && tags.length === 0) {
            throw Context.auth.error();
        }

        if (tags === 'all') {
            return undefined;
        }

        // Archived groups require full access to the organization (canAccessGroup).
        return {
            registrations: {
                $elemMatch: {
                    organization: {
                        tags: {
                            $in: tags,
                        },
                    },
                    group: { status: { $neq: GroupStatus.Archived } },
                },
            },
        };
    }

    // Grants that cover a whole period or the whole organization never reach archived
    // groups: canAccessGroup only allows those with full access.
    const groupStateFilter: StamhoofdKeyFilter = await Context.auth.canAccessArchivedGroups(organization.id)
        ? {}
        : { group: { status: { $neq: GroupStatus.Archived } } };

    if (await Context.auth.canAccessAllMembersInEveryPeriod(organization.id, permissionLevel)) {
        return {
            registrations: {
                $elemMatch: {
                    organizationId: organization.id,
                    ...groupStateFilter,
                },
            },
        };
    }

    const filters: StamhoofdFilter[] = [];
    const canAccessCurrentPeriod = await Context.auth.canAccessAllMembersInCurrentPeriod(organization.id, permissionLevel);

    if (canAccessCurrentPeriod) {
        filters.push({
            registrations: {
                $elemMatch: {
                    organizationId: organization.id,
                    periodId: organization.periodId,
                    ...groupStateFilter,
                },
            },
        });
    }

    // Check which normal membership groups we have access to and filter on those.
    // These are added next to the current period filter, not instead of it: a role
    // can hold a grant on a group of a period the organization already left.
    const groups = await Group.getAll(organization.id, null, true, [GroupType.Membership, GroupType.WaitingList]);
    Context.auth.cacheGroups(groups);
    const groupIds: string[] = [];

    for (const group of groups) {
        if (canAccessCurrentPeriod && group.periodId === organization.periodId) {
            continue;
        }

        if (await Context.auth.canAccessGroup(group, permissionLevel)) {
            groupIds.push(group.id);
        }
    }

    if (groupIds.length > 0) {
        filters.push({
            registrations: {
                $elemMatch: {
                    groupId: {
                        $in: groupIds,
                    },
                },
            },
        });
    }

    if (filters.length === 0) {
        throw Context.auth.error({
            message: 'You must filter on a group of the organization you are trying to access',
            human: $t(`%15d`),
        });
    }

    return filters.length === 1 ? filters[0] : { $or: filters };
}
