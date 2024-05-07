<template>
    <LoadingView v-if="loading" />
    <SaveView v-else class="st-view background" title="Rollen" :loading="saving" :disabled="!hasChanges" @save="save">
        <template #buttons>
            <button class="button icon add navigation" aria-label="Nieuwe beheerder" type="button" @click="addRole" />
        </template>
    
        <h1>Beheerdersrollen</h1>
        <p>Maak rollen aan om toegang te regelen tot bepaalde onderdelen. Daarna kan je één of meerdere rollen toekennen aan een beheerder. In Stamhoofd kan je zo bijvoorbeeld alle beheerders met een bepaalde rol toegang geven tot een webshop, in plaats van individueel per beheerder. Als beheerders later van rol veranderen of de vereniging verlaten, hoef je enkel maar de rollen van een beheerder te wijzigen.</p>

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

            <STList v-if="roles.length" v-model="draggableRoles" :draggable="true">
                <STListItem v-for="role in roles" :key="role.id" :selectable="true" class="right-stack" @click="editRole(role)">
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
            </STList>
        </STList>
    </SaveView>
</template>

<script lang="ts" setup>
import { patchContainsChanges, type AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SaveView, useOrganization, usePlatform, useErrors } from '@stamhoofd/components';
import { Organization, PermissionRoleDetailed, Platform, Version } from '@stamhoofd/structures';
import { ComponentOptions, Ref, computed, ref } from 'vue';
import EditRoleView from './EditRoleView.vue';
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';

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
                isNew: true
            }
        }
    }
]);

const $navigate = useNavigate();

const errors = useErrors();
const loading = ref(false);
const saving = ref(false);
const organization = useOrganization()
const platform = usePlatform()
const organizationPatch = ref(Organization.patch({})) as Ref<AutoEncoderPatchType<Organization>>
const platformPatch = ref(Platform.patch({})) as Ref<AutoEncoderPatchType<Platform>>
const patchedOrganization = computed(() => organization.value?.patch(organizationPatch.value))
const patchedPlatform = computed(() => platform.value.patch(platformPatch.value))
const hasChanges = computed(() => {
    if (organization.value) {
        return patchContainsChanges(organizationPatch.value, organization.value, {version: Version})
    }
    return patchContainsChanges(platformPatch.value, platform.value, {version: Version})
})

const roles = computed(() => {
    if (patchedOrganization.value) {
        return patchedOrganization.value.privateMeta?.roles ?? []
    }
    return patchedPlatform.value.privateConfig?.roles ?? []
})
const draggableRoles = roles;

const getAdminsForRole = (role: PermissionRoleDetailed): number => {
    // todo
    return 0
}

const getMainAdmins = (): number => {
    // todo
    return 0
}

const roleDescription = (role: PermissionRoleDetailed): string => {
    if (patchedOrganization.value) {
        return role.getDescription(patchedOrganization.value.webshops, patchedOrganization.value.groups)
    }
    return role.getDescription([], [])
}

const addRole = () => {
    $navigate('createRole')
}

const editRole = (role: PermissionRoleDetailed) => {
    // todo
}

const save = async () => {
    // todo
}
</script>