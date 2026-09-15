import { Group, Platform } from '@stamhoofd/models';
import type { StamhoofdFilter } from '@stamhoofd/structures';
import { GroupType, PermissionLevel } from '@stamhoofd/structures';
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

        const platform = await Platform.getShared();

        return {
            registrations: {
                $elemMatch: {
                    organization: {
                        tags: {
                            $in: tags,
                        },
                    },
                    periodId: platform.periodIdIfPlatform,
                },
            },
        };
    }

    if (await Context.auth.canAccessAllMembersInCurrentPeriod(organization.id, permissionLevel)) {
        if (await Context.auth.hasFullAccess(organization.id, permissionLevel)) {
            // Can access full history for now
            return {
                registrations: {
                    $elemMatch: {
                        organizationId: organization.id,
                    },
                },
            };
        }

        // Can only access current period
        return {
            registrations: {
                $elemMatch: {
                    organizationId: organization.id,
                    periodId: organization.periodId,
                },
            },
        };
    }

    // Check which normal membership groups we have access to and filter on those
    const groups = await Group.getAll(organization.id, organization.periodId, true, [GroupType.Membership, GroupType.WaitingList]);
    Context.auth.cacheGroups(groups);
    const groupIds: string[] = [];

    for (const group of groups) {
        if (await Context.auth.canAccessGroup(group, permissionLevel)) {
            groupIds.push(group.id);
        }
    }

    if (groupIds.length === 0) {
        throw Context.auth.error({
            message: 'You must filter on a group of the organization you are trying to access',
            human: $t(`%15d`),
        });
    }

    return {
        registrations: {
            $elemMatch: {
                groupId: {
                    $in: groupIds,
                },
            },
        },
    };
}
