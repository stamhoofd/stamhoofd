<template>
    <div>
        <STList>
            <STListItem element-name="label" :selectable="true" class="right-description smartphone-wrap">
                <template #left>
                    <Checkbox v-model="fullAccess" :disabled="lockedFullAccess" />
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

        <p v-if="roles.length === 0" class="info-box">
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
import { AutoEncoderPatchType, PartialWithoutMethods } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { useEmitPatch } from '@stamhoofd/components';
import { ApiUser, PermissionLevel, PermissionRole, Permissions, User } from '@stamhoofd/structures';
import { computed } from 'vue';
import RolesView from '../RolesView.vue';
import { useAdmins } from '../hooks/useAdmins';
import { useRoles } from '../hooks/useRoles';

const props = defineProps<{
    user: User | ApiUser;
}>();
const emit = defineEmits(['patch:user']);
const { patched, addPatch } = useEmitPatch<User | ApiUser>(props, emit, 'user');

const roles = useRoles();
const present = usePresent();
const { getPermissions, getPermissionsPatch, getUnloadedPermissions } = useAdmins();

const addPermissionsPatch = (patch: PartialWithoutMethods<AutoEncoderPatchType<Permissions>>) => {
    addPatch({
        permissions: getPermissionsPatch(props.user, Permissions.patch(patch)),
    });
};

const fullAccess = computed({
    get: () => getPermissions(patched.value)?.hasFullAccess() ?? false,
    set: (value: boolean) => addPermissionsPatch({ level: value ? PermissionLevel.Full : PermissionLevel.None }),
});

const lockedFullAccess = computed(() => {
    return getPermissions(patched.value)?.level === PermissionLevel.Full && getUnloadedPermissions(patched.value)?.level !== PermissionLevel.Full;
});

const getRole = (role: PermissionRole) => {
    return !!getUnloadedPermissions(patched.value)?.roles.find(r => r.id === role.id);
};

const setRole = (role: PermissionRole, enable: boolean) => {
    const p = Permissions.patch({});
    if (enable) {
        if (getRole(role)) {
            return;
        }
        p.roles.addPut(role);
    }
    else {
        p.roles.addDelete(role.id);
    }
    addPermissionsPatch(p);
};

const editRoles = async () => {
    await present({
        components: [new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(RolesView),
        })],
        modalDisplayStyle: 'popup',
    });
};

</script>
