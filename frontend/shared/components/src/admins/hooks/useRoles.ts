import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder, patchContainsChanges } from "@simonbackx/simple-encoding"
import { ErrorBox, useErrors, useOrganization, usePlatform } from "@stamhoofd/components"
import { useOrganizationManager, usePlatformManager } from "@stamhoofd/networking"
import { Group, MemberResponsibility, Organization, OrganizationPrivateMetaData, PermissionRoleDetailed, PermissionRoleForResponsibility, Platform, PlatformConfig, PlatformPrivateConfig, Version } from "@stamhoofd/structures"
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

    const createInheritedResponsibilityRolePatchArray = () => {
        return new PatchableArray() as PatchableArrayAutoEncoder<PermissionRoleForResponsibility>
    }

    const createResponsibilityPatchArray = () => {
        return new PatchableArray() as PatchableArrayAutoEncoder<MemberResponsibility>
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

    const patchInheritedResponsibilityRoles = (patch: PatchableArrayAutoEncoder<PermissionRoleForResponsibility>) => {
        if (organization.value) {
            const oPatch = Organization.patch({
                privateMeta: OrganizationPrivateMetaData.patch({
                    inheritedResponsibilityRoles: patch
                })
            })
            organizationPatch.value = organizationPatch.value.patch(oPatch)
            return;
        }
        // not supported yet on platform level
    }

    const patchResponsibilities = (patch: PatchableArrayAutoEncoder<MemberResponsibility>) => {
        if (organization.value) {
            const oPatch = Organization.patch({
                privateMeta: OrganizationPrivateMetaData.patch({
                    responsibilities: patch
                })
            })
            organizationPatch.value = organizationPatch.value.patch(oPatch)
            return;
        }
        
        const oPatch = Platform.patch({
            config: PlatformConfig.patch({
                responsibilities: patch
            })
        })
        platformPatch.value = platformPatch.value.patch(oPatch)
    }
    
    const roles = computed(() => {
        if (patchedOrganization.value) {
            return patchedOrganization.value.privateMeta?.roles ?? []
        }
        return patchedPlatform.value.privateConfig?.roles ?? []
    })

    const inheritedResponsibilityRoles = computed(() => {
        if (patchedOrganization.value) {
            return patchedOrganization.value.privateMeta?.inheritedResponsibilityRoles ?? []
        }
        return []
    })

    const applicableResponsibilities = computed(() => {
        if (patchedOrganization.value) {
            return patchedOrganization.value.privateMeta?.responsibilities ?? []
        }
        return patchedPlatform.value.config.responsibilities.filter(r => !r.organizationBased)
    })

    const responsibilities = computed(() => {
        if (patchedOrganization.value) {
            return patchedOrganization.value.privateMeta?.responsibilities ?? []
        }
        return patchedPlatform.value.config.responsibilities
    })

    const hasChanges = computed(() => {
        if (organization.value) {
            return patchContainsChanges(organizationPatch.value, organization.value, {version: Version})
        }
        return patchContainsChanges(platformPatch.value, platform.value, {version: Version})
    })
    
    const save = async (succeededHandler: () => Promise<void>|void) => {
        if (saving.value) {
            return
        }
        saving.value = true
        errors.errorBox = null
    
        if (organization.value) {
            try {
                organizationPatch.value.id = organization.value.id
                await organizationManager.value.patch(organizationPatch.value)
                await succeededHandler()
            } catch (e) {
                errors.errorBox = new ErrorBox(e)
            }
        } else {
            try {
                await platformManager.value.patch(platformPatch.value)
                await succeededHandler()
            } catch (e) {
                errors.errorBox = new ErrorBox(e)
            }
        }
    
        saving.value = false
    }


    const inheritedResponsibilitiesWithGroup = computed(() => {
        if (!organization.value) {
            return []
        }
        
        const list: {
            responsibility: MemberResponsibility, 
            group: Group|null,
            role: PermissionRoleForResponsibility|null
        }[] = []

        const org = organization.value
        for (const responsibility of patchedPlatform.value.config.responsibilities.filter(r => r.organizationBased && (r.organizationTagIds === null || org.meta.matchTags(r.organizationTagIds)))) {
            if (responsibility.organizationTagIds !== null) {
                if (!organization.value || !organization.value.meta.matchTags(responsibility.organizationTagIds)) {
                    continue
                }
            }

            if (responsibility.defaultAgeGroupIds !== null) {
                // For each matching group
                for (const group of organization.value?.adminAvailableGroups ?? []) {
                    if (group.defaultAgeGroupId && responsibility.defaultAgeGroupIds.includes(group.defaultAgeGroupId)) {
                        const role = patchedOrganization.value?.privateMeta?.inheritedResponsibilityRoles.find(r => r.responsibilityId === responsibility.id && r.responsibilityGroupId === (group?.id ?? null)) ?? null
                        list.push({responsibility, group, role})
                    }
                }
            } else {
                const role = patchedOrganization.value?.privateMeta?.inheritedResponsibilityRoles.find(r => r.responsibilityId === responsibility.id && r.responsibilityGroupId === null) ?? null
                list.push({responsibility, group: null, role})
            }
        }
        return list
    });

    return {
        errors,
        saving,
        save,
        organizationPatch,
        platformPatch,
        patchedOrganization,
        patchedPlatform,
        roles,
        responsibilities,
        applicableResponsibilities,
        inheritedResponsibilityRoles,
        inheritedResponsibilitiesWithGroup,
        patchRoles,
        patchResponsibilities,
        patchInheritedResponsibilityRoles,
        createRolePatchArray,
        createResponsibilityPatchArray,
        createInheritedResponsibilityRolePatchArray,
        hasChanges
    }
}
