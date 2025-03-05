<template>
    <SaveView :loading-view="loading" :error-box="errors.errorBox" class="st-view background" :loading="saving" :disabled="!hasChanges" @save="save" :title="$t(`636533d6-2213-42e8-a29e-b7047fe6ad1a`)">
        <template #buttons>
            <button class="button icon add navigation" aria-label="Nieuwe beheerder" type="button" @click="addRole"/>
        </template>

        <h1>{{ $t('748cdc4a-0915-42bb-b0e4-eb26d6659b35') }}</h1>
        <p>{{ $t('9021f6b0-d1ae-422b-9651-48c7f5383b0b') }}</p>

        <p class="info-box">
            {{ $t('a01c67bc-df15-4428-a5f3-19e74d38c3cd') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox"/>

        <STList>
            <STListItem>
                <template #left>
                    <span class="icon layered">
                        <span class="icon user-admin-layer-1"/>
                        <span class="icon user-admin-layer-2 yellow"/>
                    </span>
                </template>

                <h2 class="style-title-list">
                    {{ $t('a5a5fc93-fae8-4c0d-8767-4802fbffbf0d') }}
                </h2>
                <p class="style-description-small">
                    {{ $t('0748bf05-edf7-4787-a751-9e371dad19cc') }}
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
                            <span class="icon user"/>
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
                                {{ $t('890e6e03-1700-4800-b3c2-e0b4c6be1344') }}
                            </span>
                            <span class="button icon drag gray" @click.stop @contextmenu.stop/>
                            <span class="icon arrow-right-small gray"/>
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
        new Toast('De wijzigingen zijn opgeslagen', 'success green').show();
        void pop({ force: true });
    });
};

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
};

defineExpose({
    shouldNavigateAway,
});
</script>
