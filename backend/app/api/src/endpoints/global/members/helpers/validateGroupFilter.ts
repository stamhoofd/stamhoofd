import { SimpleError } from '@simonbackx/simple-errors';
import { Group } from '@stamhoofd/models';
import { FilterWrapperMarker, PermissionLevel, StamhoofdFilter, unwrapFilter, WrapperFilter } from '@stamhoofd/structures';
import { Context } from '../../../../helpers/Context';

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
            human: $t(`Je hebt geen toegangsrechten om alle leden te bekijken`),
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

    const groups = await Group.getByIDs(...groupIds as string[]);
    Context.auth.cacheGroups(groups);

    console.log('Fetching members for groups', groups.map(g => g.settings.name.toString()));

    for (const group of groups) {
        if (!await Context.auth.canAccessGroup(group, permissionLevel)) {
            throw Context.auth.error({
                message: 'You do not have access to this group',
                human: $t(`Je hebt geen toegang tot leden uit {groupName}`, { groupName: group.settings.name }),
            });
        }
    }

    return true;
}
