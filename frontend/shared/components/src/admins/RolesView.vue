<template>
    <LoadingView v-if="loading" />
    <SaveView v-else class="st-view background" title="Rollen" :loading="saving" :disabled="!hasChanges" @save="save">
        <template #buttons>
            <button class="button icon add navigation" aria-label="Nieuwe beheerder" type="button" @click="addRole" />
        </template>
    
        <h1>Beheerdersrollen</h1>
        <p>Maak rollen aan om toegang te regelen tot bepaalde onderdelen. Daarna kan je één of meerdere rollen toekennen aan een beheerder. Zo kan je bijvoorbeeld alle beheerders met een bepaalde rol toegang geven tot een webshop, in plaats van individueel per beheerder. Als beheerders later van rol veranderen of de vereniging verlaten, hoef je enkel maar de rollen van een beheerder te wijzigen.</p>

        <STErrorsDefault :error-box="errors.errorBox" />


        <hr>
        <h2>Rechten op basis van functies</h2>
        <p>Ken automatisch rechten toe aan de accounts die verbonden zijn met een lid die een bepaalde functie hebben.</p>

        <p class="info-box">
            Het concept van leden, beheerders en accounts kan verwarrend zijn. Het verschil zit hem in het feit dat leden beheerd kunnen worden door meerdere accounts (= een e-mailadres met wachtwoord waarmee je kan inloggen). Rechten en rollen worden aan accounts toegekend, terwijl je functies kan toekennen aan leden (= iemand die is ingeschreven voor een leeftijdsgroep).
        </p>

        <STList>
            <STListItem v-for="{responsibility, group} of responsibilitiesWithGroup" :key="responsibility.id" :selectable="true" class="right-stack" @click="editRoleForResponsibility(responsibility, group)">
                <template #left>
                    <span class="icon layered" v-if="!roleForResponsibility(responsibility, group)">
                        <span class="icon user-blocked-layer-1" />
                        <span class="icon user-blocked-layer-2 red" />
                    </span>

                    <span class="icon layered" v-else>
                        <span class="icon user-admin-layer-1" />
                        <span class="icon user-admin-layer-2 yellow" />
                    </span>
                </template>

                <h2 class="style-title-list">
                    {{ responsibility.name }} {{ group ? ` (${group.settings.name})` : '' }}
                </h2>

                <p class="style-description-small" v-if="!roleForResponsibility(responsibility, group)">
                    Geen automatische rechten
                </p>

                <p class="style-description-small" v-else>
                    {{  roleDescription(roleForResponsibility(responsibility, group)!) }}
                </p>

                <template #right>
                    <span v-if="getAdminsForResponsibility(responsibility, group)" class="style-tag">
                        {{ getAdminsForResponsibility(responsibility, group) }}
                    </span>
                    <span v-else class="style-tag warn">
                        0
                    </span>
                    <span class="icon arrow-right-small gray" />
                </template>

            </STListItem>
        </STList>

        <hr>
        <h2>Manueel rollen toekennen</h2>
        <p>Soms wil je de toegang van bepaalde mensen nog wat verfijnen, los van hun functies of leidinggevende taken. Bv. voor personen die geen lid zijn, of voor interne werkgroepen. Hier kan je manueel rollen aanmaken en toekennen aan bepaalde accounts.</p>

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
import { type AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, defineRoutes, useNavigate, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, SaveView, Toast, useDraggableArray, useOrganization, usePlatform } from '@stamhoofd/components';
import { Group, MemberResponsibility, PermissionRoleDetailed, PermissionRoleForResponsibility } from '@stamhoofd/structures';
import { ComponentOptions, computed } from 'vue';
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
        url: 'functie/@roleId',
        name: 'editResponsibilityRole',
        component: EditRoleView as ComponentOptions,
        present: 'popup',
        params: {
            roleId: String
        },
        paramsToProps: async (params: {roleId: string}) => {
            const role = responsibilityRoles.value.find(u => u.id === params.roleId)
            if (!role) {
                throw new Error('Role not found')
            }

            return {
                role,
                isNew: false,
                saveHandler: (patch: AutoEncoderPatchType<PermissionRoleForResponsibility>) => {
                    patch.id = role.id
                    const arr = createResponsibilityRolePatchArray();
                    arr.addPatch(patch)
                    patchResponsibilityRoles(arr);
                },
                deleteHandler: () => {
                    const arr = createResponsibilityRolePatchArray();
                    arr.addDelete(role.id)
                    patchResponsibilityRoles(arr);
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
const {createRolePatchArray, errors, hasChanges, patchRoles, roles, responsibilityRoles, patchResponsibilityRoles, createResponsibilityRolePatchArray, saving, save: rawSave} = usePatchRoles()
const platform = usePlatform();
const organization = useOrganization()
const present = usePresent()

const responsibilities = computed(() => {
    if (!organization.value) {
        return []
    }
    return platform.value.config.responsibilities
});

const responsibilitiesWithGroup = computed(() => {
    const list: {responsibility: MemberResponsibility, group: Group|null}[] = []

    for (const responsibility of responsibilities.value) {
        if (responsibility.organizationTagIds !== null) {
            if (!organization.value || !organization.value.meta.matchTags(responsibility.organizationTagIds)) {
                continue
            }
        }

        if (responsibility.defaultAgeGroupIds !== null) {
            // For each matching group
            for (const group of organization.value?.adminAvailableGroups ?? []) {
                if (group.defaultAgeGroupId && responsibility.defaultAgeGroupIds.includes(group.defaultAgeGroupId)) {
                    list.push({responsibility, group})
                }
            }
        } else {
            list.push({responsibility, group: null})
        }
    }
    return list
});

const pop = usePop()

const draggableRoles = useDraggableArray(() => {
    return roles.value
}, (roles) => {
    patchRoles(roles)
});

const getAdminsForRole = (role: PermissionRoleDetailed): number => {
    return admins.value.reduce((acc, admin) => acc + (getPermissions(admin)?.roles.find(r => r.id === role.id) ? 1 : 0), 0)
}

const getAdminsForResponsibility = (responsibility: MemberResponsibility, group: Group|null): number => {
    return admins.value.reduce((acc, admin) => acc + (getPermissions(admin)?.roles.find(r => {
        return (r instanceof PermissionRoleForResponsibility) && r.responsibilityId === responsibility.id && r.responsibilityGroupId === (group ? group.id : null)
    }) ? 1 : 0), 0)
}

const getMainAdmins = (): number => {
    return admins.value.reduce((acc, admin) => acc + (getPermissions(admin)?.hasFullAccess() ? 1 : 0), 0)
}

function roleForResponsibility(responsibility: MemberResponsibility, group: Group|null): PermissionRoleForResponsibility|null {
    return responsibilityRoles.value.find(r => r.responsibilityId === responsibility.id && r.responsibilityGroupId === (group ? group.id : null)) ?? null
}

const roleDescription = (role: PermissionRoleDetailed): string => {
    return role.getDescription()
}

const addRole = async () => {
    await $navigate('createRole')
}

const editRole = async (role: PermissionRoleDetailed|PermissionRoleForResponsibility) => {
    await $navigate('editRole', {params: {roleId: role.id}}) // not using properties because the saveHandler is set in the route
}

async function editRoleForResponsibility(responsibility: MemberResponsibility, group: Group|null) {
    const existingRole = roleForResponsibility(responsibility, group)

    if (existingRole) {
        return await $navigate('editResponsibilityRole', {params: {roleId: existingRole.id}}) // not using properties because the saveHandler is set in the route
    }

    // Create a new one
    const role = PermissionRoleForResponsibility.create({
        responsibilityId: responsibility.id,
        responsibilityGroupId: group ? group.id : null
    })

    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditRoleView, {
                role,
                isNew: true,
                saveHandler: (patch: AutoEncoderPatchType<PermissionRoleForResponsibility>) => {
                    const patched = role.patch(patch);
                    const arr = createResponsibilityRolePatchArray();
                    arr.addPut(patched)
                    patchResponsibilityRoles(arr);
                }
            })
        ]
    })
}

const save = async () => {
    await rawSave(() => {
        new Toast('De wijzigingen zijn opgeslagen', "success green").show()
        void pop({ force: true });
    });
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
}

defineExpose({
    shouldNavigateAway
})
</script>
