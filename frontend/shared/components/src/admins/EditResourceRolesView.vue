<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>{{ title }}</h1>
        <p v-if="description">{{ description }}</p>

        <p v-if="roles.length == 0" class="info-box">
            Je hebt nog geen beheerdersrollen aangemaakt. Hoofdbeheerders kunnen beheerdersrollen wijzigen via Instellingen → Beheerders. Daarna kan je de toegang hier verdelen.
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STList>
            <STListItem>
                <template #left>
                    <Checkbox :modelValue="true" :disabled="true" />
                </template>
                Hoofdbeheerders
            </STListItem>

            <ResourcePermissionRow 
                v-for="role in roles" 
                :key="role.id" 
                :role="role" 
                :resource="resource" 
                :configurableAccessRights="configurableAccessRights"
                type="role" 
                @patch:role="addPatch" 
            />
        </STList>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { AccessRight, PermissionRoleDetailed, PermissionsResourceType } from '@stamhoofd/structures';
import { Toast } from '../overlays/Toast';
import ResourcePermissionRow from './components/ResourcePermissionRow.vue';
import { usePatchRoles } from './hooks/useRoles';

withDefaults(
    defineProps<{
        title: string,
        description: string,
        resource: {id: string, name: string, type: PermissionsResourceType};
        role: PermissionRoleDetailed;
        configurableAccessRights: AccessRight[];
    }>(), {
    title: "Toegangsbeheer",
    description: "",
    configurableAccessRights: () => []
});

const {errors, hasChanges, patchRoles, roles, createRolePatchArray, saving, save: rawSave} = usePatchRoles()
const pop = usePop();

const addPatch = (role: AutoEncoderPatchType<PermissionRoleDetailed>) => {
    const arr = createRolePatchArray();
    arr.addPatch(role);
    patchRoles(arr)
}

const save = async () => {
    await rawSave(() => {
        new Toast('De wijzigingen zijn opgeslagen', "success green").show()
        pop({ force: true })
    });
}
</script>