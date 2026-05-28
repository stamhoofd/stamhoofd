import { SimpleError } from '@simonbackx/simple-errors';
import type { StamhoofdFilter, WrapperFilter } from '@stamhoofd/structures';
import { FilterWrapperMarker, PermissionLevel, unwrapFilter } from '@stamhoofd/structures';
import { Context } from '../../../../helpers/Context.js';
import { StamhoofdFilterAccessHelper } from '../../../../helpers/StamhoofdFilterAccessHelper.js';

export async function validateGroupFilter({ filter, permissionLevel, key }: { filter: StamhoofdFilter; permissionLevel: PermissionLevel; key: string | null }): Promise<boolean> {
    // Require presence of a filter
    const requiredFilter: WrapperFilter = key
        ? {
                [key]: {
                    $elemMatch: {
                        groupId: FilterWrapperMarker,
                    },
                },
            }
        : {
                groupId: FilterWrapperMarker,
            };

    const unwrapped = unwrapFilter(filter, requiredFilter);
    if (!unwrapped.match) {
        return false;
    }

    if (unwrapped.markerValue === undefined) {
        throw new SimpleError({
            code: 'invalid_field',
            field: 'filter',
            message: 'Filtering on an undefined list of groups is not supported',
        });
    }

    const groupIds = StamhoofdFilterAccessHelper.getGroupIdsFromFilter(unwrapped.markerValue);
    const groups = await Context.auth.getGroups(groupIds as string[]);

    console.log('Fetching members for groups before', groups.map(g => g.settings.name.toString()));

    for (const group of groups) {
        if (!await Context.auth.canAccessGroup(group, permissionLevel)) {
            if (permissionLevel !== PermissionLevel.Read || !group.settings.implicitlyAllowViewRegistrations) {
                throw Context.auth.error({
                    message: 'You do not have access to this group',
                    human: $t(`%15f`, { groupName: group.settings.name }),
                });
            } else {
                // Return false so we add additional scope filters (only view overlap)
                return false;
            }
        }
    }

    return true;
}
