<template>
    <LoadingView v-if="loading" />
    <SaveView v-else class="st-view background" title="Rollen" :loading="saving" :disabled="!hasChanges" @save="save">
        <template #buttons>
            <button class="button icon add navigation" aria-label="Nieuwe beheerder" type="button" @click="addRole" />
        </template>
    
        <h1>Beheerdersrollen</h1>
        <p>Maak rollen aan om toegang te regelen tot bepaalde onderdelen. Daarna kan je één of meerdere rollen toekennen aan een beheerder. Zo kan je bijvoorbeeld alle beheerders met een bepaalde rol toegang geven tot een webshop, in plaats van individueel per beheerder. Als beheerders later van rol veranderen of de vereniging verlaten, hoef je enkel maar de rollen van een beheerder te wijzigen.</p>

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
                    Hoofdbeheerder
                </h2>
                <p class="style-description-small">
                    Volledige toegang
                </p>

                <template #right>
                    <span class="style-tag">
                        {{ getMainAdmins() }}
                    </span>
                </template>
            </STListItem>

            <STList v-if="roles.length" :model-value="roles" :draggable="true" @update:model-value="setDraggableRoles($event)">
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
                                Ongebruikt
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
import { type AutoEncoderPatchType,PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { defineRoutes, useNavigate, usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, SaveView, Toast } from '@stamhoofd/components';
import { OrganizationPrivateMetaData, PermissionRoleDetailed } from '@stamhoofd/structures';
import { ComponentOptions } from 'vue';

import { createPatchableArrayForReorder } from '../../../helpers/patchableArrayHelpers';
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
            const role = PermissionRoleDetailed.create({})

            return {
                role,
                isNew: true,
                saveHandler: (patch: AutoEncoderPatchType<PermissionRoleDetailed>) => {
                    const patched = role.patch(patch);
                    const arr = createRolePatchArray();
                    arr.addPut(patched)
                    patchRoles(arr);
                },
                deleteHandler: null
            }
        }
    },
    {
        url: '@roleId',
        name: 'editRole',
        component: EditRoleView as ComponentOptions,
        present: 'popup',
        params: {
            roleId: String
        },
        paramsToProps: async (params: {roleId: string}) => {
            const role = roles.value.find(u => u.id === params.roleId)
            if (!role) {
                throw new Error('Role not found')
            }

            return {
                role,
                isNew: false,
                saveHandler: (patch: AutoEncoderPatchType<PermissionRoleDetailed>) => {
                    patch.id = role.id
                    const arr = createRolePatchArray();
                    arr.addPatch(patch)
                    patchRoles(arr);
                },
                deleteHandler: () => {
                    const arr = createRolePatchArray();
                    arr.addDelete(role.id)
                    patchRoles(arr);
                },
            }
        },
        propsToParams(props) {
            if (!("role" in props)) {
                throw new Error('Missing role')
            }
            return {
                params: {
                    roleId: (props.role as PermissionRoleDetailed).id
                }
            }
        }
    }
]);

const $navigate = useNavigate();

const {getPermissions, loading, admins} = useAdmins()
const {errors, hasChanges, patchRoles, roles, saving, save: rawSave} = usePatchRoles()

const pop = usePop()

const createRolePatchArray = () => {
    return new PatchableArray() as PatchableArrayAutoEncoder<PermissionRoleDetailed>
}

const getAdminsForRole = (role: PermissionRoleDetailed): number => {
    return admins.value.reduce((acc, admin) => acc + (getPermissions(admin)?.roles.find(r => r.id === role.id) ? 1 : 0), 0)
}

const getMainAdmins = (): number => {
    return admins.value.reduce((acc, admin) => acc + (getPermissions(admin)?.hasFullAccess() ? 1 : 0), 0)
}

const roleDescription = (role: PermissionRoleDetailed): string => {
    return role.getDescription()
}

const addRole = () => {
    $navigate('createRole')
}

const editRole = (role: PermissionRoleDetailed) => {
    $navigate('editRole', {params: {roleId: role.id}}) // not using properties because the saveHandler is set in the route
}

const save = async () => {
    await rawSave(() => {
        new Toast('De wijzigingen zijn opgeslagen', "success green").show()
        pop({ force: true })
    });
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
}

function setDraggableRoles(draggableRoles: PermissionRoleDetailed[] | undefined) {
    const patchableArray = createPatchableArrayForReorder<OrganizationPrivateMetaData, PermissionRoleDetailed>(draggableRoles, roles.value,OrganizationPrivateMetaData, 'roles' );

    if(patchableArray) {
        patchRoles(patchableArray)
    }
}

defineExpose({
    shouldNavigateAway
})
</script>
