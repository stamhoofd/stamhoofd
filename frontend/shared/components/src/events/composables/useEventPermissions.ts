import { AccessRight, NamedObject, Organization, OrganizationTag, PermissionsResourceType } from '@stamhoofd/structures';
import { useAuth, usePlatform } from '../../hooks';

export function useEventPermissions() {
    const auth = useAuth();
    const platform = usePlatform();
    const permissions = auth.permissions;

    function canAdminSome() {
        if (!permissions) {
            return false;
        }

        return permissions.hasAccessRightForSomeResource(PermissionsResourceType.OrganizationTags, AccessRight.EventWrite) || permissions.hasAccessRightForSomeResource(PermissionsResourceType.Groups, AccessRight.EventWrite);
    }

    function canAdminAllGroupEvents() {
        if (!permissions) {
            return false;
        }
        return permissions.hasAccessRightForAllResourcesOfType(PermissionsResourceType.Groups, AccessRight.EventWrite);
    }

    function canAdminAllTagEvents() {
        if (!permissions) {
            return false;
        }
        return permissions.hasAccessRightForAllResourcesOfType(PermissionsResourceType.OrganizationTags, AccessRight.EventWrite);
    }

    function hasGroupRestrictions() {
        if (!permissions) {
            return false;
        }

        if (canAdminAllGroupEvents()) {
            return false;
        }

        return permissions.hasAccessRightForSomeResource(PermissionsResourceType.Groups, AccessRight.EventWrite);
    }

    function hasTagRestrictions() {
        if (!permissions) {
            return false;
        }

        if (canAdminAllTagEvents()) {
            return false;
        }

        return permissions.hasAccessRightForSomeResource(PermissionsResourceType.OrganizationTags, AccessRight.EventWrite);
    }

    function isGroupEnabledOperatorFactory() {
        if (!permissions) {
            return () => false;
        }

        return (group: NamedObject) => permissions.hasResourceAccessRight(PermissionsResourceType.Groups, group.id, AccessRight.EventWrite);
    }

    function isTagEnabledOperatorFactory() {
        if (!permissions) {
            return () => false;
        }

        return (tag: OrganizationTag) => permissions.hasResourceAccessRight(PermissionsResourceType.OrganizationTags, tag.id, AccessRight.EventWrite);
    }

    function canAdminEventForExternalOrganization(organization: Organization) {
        const organizationPermissions = auth.user?.permissions?.forOrganization(organization, platform.value);
        return organizationPermissions?.hasAccessRight(AccessRight.EventWrite) ?? false;
    }

    return {
        canAdminSome,
        hasGroupRestrictions,
        hasTagRestrictions,
        isGroupEnabledOperatorFactory,
        isTagEnabledOperatorFactory,
        canAdminEventForExternalOrganization,
    };
}
