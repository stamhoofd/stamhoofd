import { SimpleError } from '@simonbackx/simple-errors';
import { FilterWrapperMarker, PermissionLevel, StamhoofdFilter, unwrapFilter, WrapperFilter } from '@stamhoofd/structures';
import { Context } from '../../../../helpers/Context.js';

export async function validateGroupFilter({ filter, permissionLevel, key }: { filter: StamhoofdFilter; permissionLevel: PermissionLevel; key: string | null }) {
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

    const groupIds = typeof unwrapped.markerValue === 'string'
        ? [unwrapped.markerValue]
        : unwrapFilter(unwrapped.markerValue as StamhoofdFilter, {
            $in: FilterWrapperMarker,
        })?.markerValue;

    if (!Array.isArray(groupIds)) {
        throw new SimpleError({
            code: 'invalid_field',
            field: 'filter',
            message: 'You must filter on a group of the organization you are trying to access',
            human: $t(`5efbaed8-004e-40b9-a822-bdb31e35fbb7`),
        });
    }

    if (groupIds.length === 0) {
        throw new SimpleError({
            code: 'invalid_field',
            field: 'filter',
            message: 'Filtering on an empty list of groups is not supported',
        });
    }

    for (const groupId of groupIds) {
        if (typeof groupId !== 'string') {
            throw new SimpleError({
                code: 'invalid_field',
                field: 'filter',
                message: 'Invalid group ID in filter',
            });
        }
    }

    const groups = await Context.auth.getGroups(groupIds as string[]);

    console.log('Fetching members for groups before', groups.map(g => g.settings.name.toString()));

    for (const group of groups) {
        if (!await Context.auth.canAccessGroup(group, permissionLevel)) {
            if (permissionLevel !== PermissionLevel.Read || !group.settings.implicitlyAllowViewRegistrations) {
                throw Context.auth.error({
                    message: 'You do not have access to this group',
                    human: $t(`45eedf49-0f0a-442c-a0bd-7881c2682698`, { groupName: group.settings.name }),
                });
            }
            else {
                // Return false so we add additional scope filters (only view overlap)
                return false;
            }
        }
    }

    return true;
}
