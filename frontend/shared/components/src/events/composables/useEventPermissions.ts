import type { NamedObject, Organization, OrganizationTag, StamhoofdFilter } from '@stamhoofd/structures';
import { AccessRight, EventPeriodHelper, PermissionLevel, PermissionsResourceKey, PermissionsResourceType } from '@stamhoofd/structures';
import { useAuth } from '#hooks/useAuth.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { usePlatform } from '#hooks/usePlatform.ts';

export function useEventPermissions() {
    const auth = useAuth();
    const platform = usePlatform();
    const organization = useOrganization();
    const permissions = auth.permissions;

    function canWriteSome() {
        if (!permissions) {
            return false;
        }

        return permissions.hasAccessRightForSomeResourceOfType(PermissionsResourceType.OrganizationTags, AccessRight.EventWrite)
            || permissions.hasAccessRightForSomeResourceOfType(PermissionsResourceType.Groups, AccessRight.EventWrite)
            || permissions.hasAccessForSomeResourceOfType(PermissionsResourceType.Events, PermissionLevel.Write);
    }

    /**
     * Events that are writable because of a permission on the event itself, on top of the group and tag based access.
     * Returns null when every event is writable this way.
     */
    function eventResourceFilters(): StamhoofdFilter[] | null {
        if (!permissions) {
            return [];
        }

        if (permissions.hasAccess(PermissionLevel.Write)) {
            return null;
        }

        const ids: string[] = [];
        const filters: StamhoofdFilter[] = [];

        for (const [id, resource] of permissions.resources.get(PermissionsResourceType.Events) ?? []) {
            if (!resource.hasAccess(PermissionLevel.Write)) {
                continue;
            }

            if (id === PermissionsResourceKey.All) {
                return null;
            }

            if (id === PermissionsResourceKey.CurrentPeriod) {
                filters.push(...auth.getPeriodsInUse(organization.value).map(period => EventPeriodHelper.getPeriodFilter(period)));
                continue;
            }

            ids.push(id);
        }

        if (ids.length > 0) {
            filters.push({ id: { $in: ids } });
        }

        return filters;
    }

    function canWriteAllGroupEvents() {
        if (!permissions) {
            return false;
        }
        return permissions.hasAccessRightForAllResourcesOfType(PermissionsResourceType.Groups, AccessRight.EventWrite);
    }

    function canWriteAllTagEvents() {
        if (!permissions) {
            return false;
        }
        return permissions.hasAccessRightForAllResourcesOfType(PermissionsResourceType.OrganizationTags, AccessRight.EventWrite);
    }

    function groupsToFilterEventsOn(): string[] | null {
        return filterEventsOn(PermissionsResourceType.Groups);
    }

    function tagsToFilterEventsOn(): string[] | null {
        return filterEventsOn(PermissionsResourceType.OrganizationTags);
    }

    function isGroupEnabledOperatorFactory() {
        if (!permissions) {
            return () => false;
        }

        return (group: NamedObject) => permissions.hasResourceAccessRight(PermissionsResourceType.Groups, group.id, AccessRight.EventWrite);
    }

    function isTagEnabledPredicateFactory() {
        if (!permissions) {
            return () => false;
        }

        return (tag: OrganizationTag) => permissions.hasResourceAccessRight(PermissionsResourceType.OrganizationTags, tag.id, AccessRight.EventWrite);
    }

    function canAdminEventForExternalOrganization(organization: Organization) {
        const organizationPermissions = auth.user?.permissions?.forOrganization(organization, platform.value);
        return organizationPermissions?.hasAccessRight(AccessRight.EventWrite) ?? false;
    }

    function filterEventsOn(type: PermissionsResourceType): string[] | null {
        if (!permissions) {
            return null;
        }

        if (permissions.hasAccessRightForAllResourcesOfType(type, AccessRight.EventWrite)) {
            return null;
        }

        const result = new Set<string>();

        const ressources = permissions.resources.get(type);
        if (ressources) {
            for (const [tagId, permissions] of ressources.entries()) {
                if (permissions.hasAccessRight(AccessRight.EventWrite)) {
                    result.add(tagId);
                }
            }
        }

        return [...result];
    }

    return {
        canWriteSome,
        canWriteAllGroupEvents,
        canWriteAllTagEvents,
        isGroupEnabledOperatorFactory,
        isTagEnabledPredicateFactory,
        canAdminEventForExternalOrganization,
        tagsToFilterEventsOn,
        groupsToFilterEventsOn,
        eventResourceFilters,
    };
}
