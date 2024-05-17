import { ContextPermissions } from "@stamhoofd/networking"
import { Ref } from "vue"
import { useOrganization } from "./useOrganization"
import { usePlatform } from "./usePlatform"
import { useUser } from "./useUser"
import { Organization, Platform, User } from "@stamhoofd/structures"

/**
 * Allows you to use the ContextPermissions object in a specific context (editing user permissions mostly)
 * without inheriting permissions if the user is also a global admin (which gives them full access to everything, but breaks editing permissions)
 */
export function useUninheritedPermissions(overrides?: {patchedUser?: User|Ref<User>, patchedOrganization?: Organization|Ref<Organization|null>, patchedPlatform?: Platform|Ref<Platform>}): ContextPermissions {
    const user = overrides?.patchedUser ?? useUser()
    const organization = overrides?.patchedOrganization ?? useOrganization()
    const platform = overrides?.patchedPlatform ?? usePlatform()

    return new ContextPermissions(user, organization, platform, {allowInheritingPermissions: false})
}
