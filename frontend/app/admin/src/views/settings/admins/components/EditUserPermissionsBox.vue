<template>
    <div>
        <STList>
            <STListItem element-name="label" :selectable="true" class="right-description smartphone-wrap">
                <template #left>
                    <Checkbox v-model="fullAccess" />
                </template>
                Hoofdbeheerder

                <template #right>
                    Kan alles bekijken en bewerken
                </template>
            </STListItem>

            <STListItem v-for="role in roles" :key="role.id" element-name="label" :selectable="true" class="right-description smartphone-wrap">
                <template #left>
                    <Checkbox :model-value="getRole(role)" @update:model-value="setRole(role, $event)" />
                </template>
                {{ role.name }}
            </STListItem>
        </STList>

        <p v-if="roles.length == 0" class="info-box">
            Je hebt nog geen rollen aangemaakt. Maak een rol aan om beheerders op te delen.
        </p>

        <p class="style-button-bar">
            <button class="button text" type="button" @click="editRoles">
                <span class="icon edit" />
                <span>Rollen bewerken</span>
            </button>
        </p>
    </div>
</template>

<script setup lang="ts">
import { useEmitPatch, usePermissions } from '@stamhoofd/components';
import { PermissionLevel, PermissionRole, User, Permissions } from '@stamhoofd/structures';
import { useRoles } from '../hooks/useRoles';
import { computed } from 'vue';
import { AutoEncoderPatchType, PartialWithoutMethods } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import RolesView from '../RolesView.vue';

const props = defineProps(['user'])
const emit = defineEmits(['patch:user'])
const {patched, addPatch} = useEmitPatch<User>(props, emit, 'user')

const roles = useRoles();
const permissions = usePermissions({patchedUser: patched})
const present = usePresent();

const addPermissionsPatch = (patch: PartialWithoutMethods<AutoEncoderPatchType<Permissions>>) => {
    addPatch({
        permissions: permissions.createPatch(patch)
    })
}

const fullAccess = computed({
    get: () => permissions.hasFullAccess(),
    set: (value: boolean) => addPermissionsPatch({level: value ? PermissionLevel.Full : PermissionLevel.None})
})

const getRole = (role: PermissionRole) => {
    return !!permissions.permissions?.roles.find(r => r.id === role.id)
}

const setRole = (role: PermissionRole, enable: boolean) => {
    const p = Permissions.patch({})
    if (enable) {
        if (getRole(role)) {
            return
        }
        p.roles.addPut(role)
    } else {
        p.roles.addDelete(role.id)
    }
    addPermissionsPatch(p)
}

const editRoles = async () => {
    await present({
        components: [new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(RolesView)
        })],
        modalDisplayStyle: "popup"
    })
}

</script>