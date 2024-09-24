import { AccessRight, NamedObject, Organization, OrganizationTag, PermissionsResourceType } from '@stamhoofd/structures';
import { useAuth, usePlatform } from '../../hooks';

export function useEventPermissions() {
    const auth = useAuth();
    const platform = usePlatform();
    const permissions = auth.permissions;

    function canWriteSome() {
        if (!permissions) {
            return false;
        }

        return permissions.hasAccessRightForSomeResource(PermissionsResourceType.OrganizationTags, AccessRight.EventWrite) || permissions.hasAccessRightForSomeResource(PermissionsResourceType.Groups, AccessRight.EventWrite);
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

        const result = new Set<string>();

        for (const ressourceMap of [permissions.resources, ...permissions.roles.map(r => r.resources)]) {
            const ressources = ressourceMap.get(type);
            if (ressources) {
                for (const [tagId, permissions] of ressources.entries()) {
                    if (permissions.hasAccessRight(AccessRight.EventWrite)) {
                        result.add(tagId);
                    }
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
    };
}
