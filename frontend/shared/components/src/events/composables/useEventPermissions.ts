import { EventPermissionChecker, Organization, Platform, User } from '@stamhoofd/structures';
import { computed, Ref } from 'vue';

export function useEventPermissions({ user, platform, organization }: { user: Ref<User | null>; platform: Ref<Platform | null>; organization: Ref<Organization | null> }) {
    const userPermissions = computed(() => user.value?.permissions ?? null);
    const platformPermissions = computed(() => platform.value ? userPermissions.value?.forPlatform(platform.value) ?? null : null);
    const organizationPermissions = computed(() => organization.value ? userPermissions.value?.forOrganization(organization.value, null) ?? null : null);
    const allPermissions = computed(() => {
        return {
            userPermissions: userPermissions.value,
            platformPermissions: platformPermissions.value,
            organizationPermissions: organizationPermissions.value,
        };
    });

    function canAdminSome() {
        return EventPermissionChecker.canAdminSome(allPermissions.value);
    }

    function hasGroupRestrictions() {
        return EventPermissionChecker.hasGroupRestrictions({
            userPermissions: userPermissions.value,
            organizationPermissions: organizationPermissions.value,
        });
    }

    function hasTagRestrictions() {
        return EventPermissionChecker.hasTagRestrictions({
            userPermissions: userPermissions.value,
            platformPermissions: platformPermissions.value,
        });
    }

    function isGroupEnabledOperatorFactory() {
        return EventPermissionChecker.isGroupEnabledOperatorFactory({
            userPermissions: userPermissions.value,
            organizationPermissions: organizationPermissions.value,
        });
    }

    function isTagEnabledOperatorFactory() {
        return EventPermissionChecker.isTagEnabledOperatorFactory({
            userPermissions: userPermissions.value,
            platformPermissions: platformPermissions.value,
        });
    }

    function canAdminSomeOrganizationEvent() {
        return EventPermissionChecker.canAdminSomeOrganizationEvent(allPermissions.value);
    }

    return {
        userPermissions,
        platformPermissions,
        organizationPermissions,
        canAdminSome,
        hasGroupRestrictions,
        hasTagRestrictions,
        isGroupEnabledOperatorFactory,
        isTagEnabledOperatorFactory,
        canAdminSomeOrganizationEvent,
    };
}
