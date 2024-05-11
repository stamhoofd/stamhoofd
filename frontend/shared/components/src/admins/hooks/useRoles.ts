import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder, patchContainsChanges } from "@simonbackx/simple-encoding"
import { ErrorBox, useErrors, useOrganization, usePlatform } from "@stamhoofd/components"
import { useOrganizationManager, usePlatformManager } from "@stamhoofd/networking"
import { Organization, OrganizationPrivateMetaData, PermissionRoleDetailed, Platform, PlatformPrivateConfig, Version } from "@stamhoofd/structures"
import { computed, Ref, ref } from "vue"

export function useRoles() {
    const organization = useOrganization()
    const platformManager = usePlatformManager()

    return computed(() => {
        if (organization.value) {
            return organization.value?.privateMeta?.roles ?? []
        }
    
        // Platform scope
        return platformManager.value.$platform.privateConfig?.roles ?? []
    })
}


export function usePatchRoles() {
    const organization = useOrganization()
    const platform = usePlatform()
    
    const organizationPatch = ref(Organization.patch({})) as Ref<AutoEncoderPatchType<Organization>>
    const platformPatch = ref(Platform.patch({})) as Ref<AutoEncoderPatchType<Platform>>
    const patchedOrganization = computed(() => organization.value?.patch(organizationPatch.value))
    const patchedPlatform = computed(() => platform.value.patch(platformPatch.value))
    const organizationManager = useOrganizationManager()
    const platformManager = usePlatformManager()
    const saving = ref(false);
    const errors = useErrors();

    const createRolePatchArray = () => {
        return new PatchableArray() as PatchableArrayAutoEncoder<PermissionRoleDetailed>
    }
    const patchRoles = (patch: PatchableArrayAutoEncoder<PermissionRoleDetailed>) => {
        if (organization.value) {
            const oPatch = Organization.patch({
                privateMeta: OrganizationPrivateMetaData.patch({
                    roles: patch
                })
            })
            organizationPatch.value = organizationPatch.value.patch(oPatch)
            return;
        }
        const oPatch = Platform.patch({
            privateConfig: PlatformPrivateConfig.patch({
                roles: patch
            })
        })
        platformPatch.value = platformPatch.value.patch(oPatch)
        return;
    }
    
    const roles = computed(() => {
        if (patchedOrganization.value) {
            return patchedOrganization.value.privateMeta?.roles ?? []
        }
        return patchedPlatform.value.privateConfig?.roles ?? []
    })

    const hasChanges = computed(() => {
        if (organization.value) {
            return patchContainsChanges(organizationPatch.value, organization.value, {version: Version})
        }
        return patchContainsChanges(platformPatch.value, platform.value, {version: Version})
    })
    
    const save = async (succeededHandler: () => void) => {
        if (saving.value) {
            return
        }
        saving.value = true
        errors.errorBox = null
    
        if (organization.value) {
            try {
                organizationPatch.value.id = organization.value.id
                await organizationManager.value.patch(organizationPatch.value)
                succeededHandler()
            } catch (e) {
                errors.errorBox = new ErrorBox(e)
            }
        } else {
            try {
                await platformManager.value.patch(platformPatch.value)
                succeededHandler()
            } catch (e) {
                errors.errorBox = new ErrorBox(e)
            }
        }
    
        saving.value = false
    }

    return {
        errors,
        saving,
        save,
        organizationPatch,
        platformPatch,
        patchedOrganization,
        patchedPlatform,
        roles,
        patchRoles,
        createRolePatchArray,
        hasChanges
    }
}
