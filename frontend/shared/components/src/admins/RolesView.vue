<template>
    <SaveView :loading-view="loading" :error-box="errors.errorBox" class="st-view background" :loading="saving" :disabled="!hasChanges" :title="$t(`83ce9418-2abf-4d9b-a6b4-312df7ac4837`)" @save="save">
        <template #buttons>
            <button class="button icon add" aria-label="Nieuwe beheerder" type="button" @click="addRole" />
        </template>

        <h1>{{ $t('697d96d8-17dc-4e98-8571-87153985f3a1') }}</h1>
        <p>{{ $t('9021f6b0-d1ae-422b-9651-48c7f5383b0b') }}</p>

        <p class="info-box">
            {{ $t('49da8533-b5b6-4ca1-9cd5-1ff8dc6486eb') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STList>
            <STListItem>
                <template #left>
                    <span class="icon layered">
                        <span class="icon user-admin-layer-1" />
                        <span class="icon user-admin-layer-2 yellow" />
                    </span>
                </template>

                <h2 class="style-title-list">
                    {{ $t('06e0f25f-f601-4359-a95d-b72fd79ecbdd') }}
                </h2>
                <p class="style-description-small">
                    {{ $t('c2296305-99a9-497a-aed3-7bb3d2293ce8') }}
                </p>

                <template #right>
                    <span class="style-tag">
                        {{ getMainAdmins() }}
                    </span>
                </template>
            </STListItem>

            <STList v-if="draggableRoles.length" v-model="draggableRoles" :draggable="true">
                <template #item="{item: role}">
                    <STListItem :selectable="true" class="right-stack" @click="editRole(role)">
                        <template #left>
                            <span class="icon user" />
                        </template>

                        <h2 class="style-title-list">
                            {{ role.name }}
                        </h2>
                        <p class="style-description-small">
                            {{ roleDescription(role) }}
                        </p>

                        <template #right>
                            <span v-if="getAdminsForRole(role)" class="style-tag">
                                {{ getAdminsForRole(role) }}
                            </span>
                            <span v-else class="style-tag warn">
                                {{ $t('2f5d5e2d-cc3b-4cf6-8f4e-97b72a106163') }}
                            </span>
                            <span class="button icon drag gray" @click.stop @contextmenu.stop />
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </template>
            </STList>
        </STList>
    </SaveView>
</template>

<script lang="ts" setup>
import { type AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { defineRoutes, useNavigate, usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, SaveView, Toast, useDraggableArray } from '@stamhoofd/components';
import { PermissionRoleDetailed, PermissionRoleForResponsibility } from '@stamhoofd/structures';
import { ComponentOptions } from 'vue';
import STList from '../layout/STList.vue';
import EditRoleView from './EditRoleView.vue';
import { useAdmins } from './hooks/useAdmins';
import { usePatchRoles } from './hooks/useRoles';

defineRoutes([
    {
        url: 'nieuw',
        name: 'createRole',
        component: EditRoleView as ComponentOptions,
        present: 'popup',
        paramsToProps: () => {
            const role = PermissionRoleDetailed.create({});

            return {
                role,
                isNew: true,
                saveHandler: (patch: AutoEncoderPatchType<PermissionRoleDetailed>) => {
                    const patched = role.patch(patch);
                    const arr = createRolePatchArray();
                    arr.addPut(patched);
                    patchRoles(arr);
                },
                deleteHandler: null,
            };
        },
    },
    {
        url: '@roleId',
        name: 'editRole',
        component: EditRoleView as ComponentOptions,
        present: 'popup',
        params: {
            roleId: String,
        },
        paramsToProps: async (params: { roleId: string }) => {
            const role = roles.value.find(u => u.id === params.roleId);
            if (!role) {
                throw new Error('Role not found');
            }

            return {
                role,
                isNew: false,
                saveHandler: (patch: AutoEncoderPatchType<PermissionRoleDetailed>) => {
                    patch.id = role.id;
                    const arr = createRolePatchArray();
                    arr.addPatch(patch);
                    patchRoles(arr);
                },
                deleteHandler: () => {
                    const arr = createRolePatchArray();
                    arr.addDelete(role.id);
                    patchRoles(arr);
                },
            };
        },
        propsToParams(props) {
            if (!('role' in props)) {
                throw new Error('Missing role');
            }
            return {
                params: {
                    roleId: (props.role as PermissionRoleDetailed).id,
                },
            };
        },
    },
]);

const $navigate = useNavigate();

const { getPermissions, getUnloadedPermissions, loading, admins } = useAdmins();
const { createRolePatchArray, errors, hasChanges, patchRoles, roles, saving, save: rawSave } = usePatchRoles();

const pop = usePop();

const draggableRoles = useDraggableArray(() => {
    return roles.value;
}, (roles) => {
    patchRoles(roles);
});

const getAdminsForRole = (role: PermissionRoleDetailed): number => {
    return admins.value.reduce((acc, admin) => acc + (getUnloadedPermissions(admin)?.roles.find(r => r.id === role.id) ? 1 : 0), 0);
};

const getMainAdmins = (): number => {
    return admins.value.reduce((acc, admin) => acc + (getPermissions(admin)?.hasFullAccess() ? 1 : 0), 0);
};

const roleDescription = (role: PermissionRoleDetailed): string => {
    return role.getDescription();
};

const addRole = async () => {
    await $navigate('createRole');
};

const editRole = async (role: PermissionRoleDetailed | PermissionRoleForResponsibility) => {
    await $navigate('editRole', { params: { roleId: role.id } }); // not using properties because the saveHandler is set in the route
};

const save = async () => {
    await rawSave(() => {
        new Toast($t(`89360094-8856-4b28-8921-e3d561ef824c`), 'success green').show();
        void pop({ force: true });
    });
};

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t(`3953d383-4f04-42ea-83cd-bf65478ed4a9`), $t(`4cfb2940-8532-446e-b543-a4c7ba9618a3`));
};

defineExpose({
    shouldNavigateAway,
});
</script>
