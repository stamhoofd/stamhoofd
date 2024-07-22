<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>{{ title }}</h1>
        <p v-if="description">
            {{ description }}
        </p>


        <STErrorsDefault :error-box="errors.errorBox" />
        
        <div v-for="{title: groupTitle, roles: groupRoles} in groupedResponsibilites" :key="groupTitle" class="container">
            <hr>
            <h2>{{ groupTitle }}</h2>

            <STList>
                <ResourcePermissionRow 
                    v-for="{role, inheritedRole, patch} in groupRoles" 
                    :key="role.id" 
                    :role="role" 
                    :inherited-roles="inheritedRole ? [inheritedRole] : []"
                    :resource="resource" 
                    :configurable-access-rights="configurableAccessRights"
                    type="role" 
                    @patch:role="patch" 
                />
            </STList>
        </div>

        <hr>
        <h2>Externe beheerdersrollen</h2>
        <p>Je kan toegang geven aan externe beheerders (beheerders die geen lid zijn) via externe beheerdersrollen.</p>

        <p v-if="roles.length == 0" class="info-box">
            Je hebt nog geen beheerdersrollen aangemaakt. Hoofdbeheerders kunnen beheerdersrollen wijzigen via Instellingen → Beheerders. Daarna kan je de toegang hier verdelen.
        </p>

        <STList>
            <ResourcePermissionRow 
                v-for="role in roles" 
                :key="role.id" 
                :role="role" 
                :resource="resource" 
                :configurable-access-rights="configurableAccessRights"
                type="role" 
                @patch:role="addPatch" 
            />
        </STList>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { AccessRight, MemberResponsibility, PermissionRoleDetailed, PermissionRoleForResponsibility, PermissionsResourceType } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useOrganization } from '../hooks';
import { Toast } from '../overlays/Toast';
import ResourcePermissionRow from './components/ResourcePermissionRow.vue';
import { usePatchRoles } from './hooks/useRoles';

withDefaults(
    defineProps<{
        title: string,
        description: string,
        resource: {id: string, name: string, type: PermissionsResourceType};
        configurableAccessRights: AccessRight[];
    }>(), {
        title: "Toegangsbeheer",
        description: "",
        configurableAccessRights: () => []
    });

const {errors, hasChanges, patchRoles, roles, inheritedResponsibilityRoles, inheritedResponsibilitiesWithGroup, applicableResponsibilities, responsibilities, patchResponsibilities, patchInheritedResponsibilityRoles, createRolePatchArray, createResponsibilityPatchArray, createInheritedResponsibilityRolePatchArray, saving, save: rawSave} = usePatchRoles()
const pop = usePop();
const organization = useOrganization();

const addPatch = (role: AutoEncoderPatchType<PermissionRoleDetailed>) => {
    const arr = createRolePatchArray();
    arr.addPatch(role);
    patchRoles(arr)
}

const groupedResponsibilites = computed(() => {
    const groupedPlatformResponsibilities: {
        role: PermissionRoleForResponsibility, 
        inheritedRole: PermissionRoleDetailed|null,
        patch: (patch: AutoEncoderPatchType<PermissionRoleForResponsibility>) => void
    }[] = []

    const groupedOrganizationResponsibilities:  {
        role: PermissionRoleForResponsibility, 
        inheritedRole: PermissionRoleDetailed|null,
        patch: (patch: AutoEncoderPatchType<PermissionRoleForResponsibility>) => void
    }[] = []

    for (const {responsibility, group, role} of inheritedResponsibilitiesWithGroup.value) {
        groupedPlatformResponsibilities.push({
            role: role ?? responsibility.createDefaultPermissions(group),
            inheritedRole: responsibility.getPermissions(group?.id ?? null), // todo: also implement group level ones
            patch: (patch: AutoEncoderPatchType<PermissionRoleForResponsibility>) => patchInheritedResponsibilityRole(patch, responsibility.id, group?.id ?? null)
        })
    }

    for (const responsibility of applicableResponsibilities.value) {
        if (responsibility.defaultAgeGroupIds === null) {
            groupedOrganizationResponsibilities.push({
                role: responsibility.permissions ?? responsibility.createDefaultPermissions(null),
                inheritedRole: null,
                patch: (patch: AutoEncoderPatchType<PermissionRoleForResponsibility>) => patchResponsibilityRole(patch, responsibility.id)
            })
            continue;
        }
    }
    
    // Merge non-empty groups
    const groups: {title: string, roles: typeof groupedPlatformResponsibilities}[] = []

    if (groupedPlatformResponsibilities.length > 0) {
        groups.push({
            title: organization.value === null ? '' : 'Standaardfuncties',
            roles: groupedPlatformResponsibilities
        })
    }

    if (groupedOrganizationResponsibilities.length > 0) {
        groups.push({
            title: 'Groepseigenfuncties',
            roles: groupedOrganizationResponsibilities
        })
    }

    return groups;
})

function patchInheritedResponsibilityRole(patch: AutoEncoderPatchType<PermissionRoleForResponsibility>, responsibilityId: string, groupId: string|null) {
    const responsibility = inheritedResponsibilitiesWithGroup.value.find(r => r.responsibility.id === responsibilityId && (r.group?.id ?? null) === groupId);
    if (!responsibility) {
        throw new Error("Responsibility not found")
    }

    const inheritedRole = inheritedResponsibilityRoles.value.find(r => r.responsibilityId == responsibilityId && r.responsibilityGroupId === groupId);
    const arr = createInheritedResponsibilityRolePatchArray()

    if (!inheritedRole) {
        // Create a new one
        const role = responsibility.responsibility.createDefaultPermissions(responsibility.group)
        const patched = role.patch(patch)
        arr.addPut(patched)
    } else {
        arr.addPatch(patch)
    }

    patchInheritedResponsibilityRoles(arr)
}

function patchResponsibilityRole(patch: AutoEncoderPatchType<PermissionRoleForResponsibility>, responsibilityId: string) {
    const responsibility = responsibilities.value.find(r => r.id == responsibilityId);
    if (!responsibility) {
        throw new Error("Responsibility not found")
    }

    const arr = createResponsibilityPatchArray()
    if (responsibility.permissions) {
        // Patch
        const p = MemberResponsibility.patch({
            id: responsibility.id,
            permissions: patch
        })
        arr.addPatch(p)
    } else {
        // Create
        const p = MemberResponsibility.patch({
            id: responsibility.id,
            permissions: responsibility.createDefaultPermissions(null).patch(patch)
        })
        arr.addPatch(p)
    }
    patchResponsibilities(arr)

}

const save = async () => {
    await rawSave(async () => {
        new Toast('De wijzigingen zijn opgeslagen', "success green").show()
        await pop({ force: true })
    });
}
</script>
