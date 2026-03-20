<template>
    <div>
        <STList>
            <STListItem element-name="label" :selectable="true" class="right-description smartphone-wrap">
                <template #left>
                    <Checkbox v-model="fullAccess" :disabled="lockedFullAccess" />
                </template>
                {{ $t('%Yb') }}

                <template #right>
                    {{ $t('%ZJ') }}
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
            {{ $t('%ZK') }}
        </p>

        <p class="style-button-bar">
            <button class="button text" type="button" @click="editRoles">
                <span class="icon edit" />
                <span>{{ $t('%ZL') }}</span>
            </button>
        </p>
    </div>
</template>

<script setup lang="ts">
import type { AutoEncoderPatchType, PartialWithoutMethods } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { useEmitPatch } from '#hooks/useEmitPatch.ts';
import type { ApiUser, PermissionRole, User } from '@stamhoofd/structures';
import { PermissionLevel, Permissions } from '@stamhoofd/structures';
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
