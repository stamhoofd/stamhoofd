<template>
    <LoadingView v-if="loading" />
    <SaveView v-else class="st-view background" title="Rollen" :loading="saving" :disabled="!hasChanges" @save="save">
        <template #buttons>
            <button class="button icon add navigation" aria-label="Nieuwe beheerder" type="button" @click="addRole" />
        </template>
    
        <h1>Beheerdersrollen</h1>
        <p>Maak rollen aan om toegang te regelen tot bepaalde onderdelen. Daarna kan je één of meerdere rollen toekennen aan een beheerder. In Stamhoofd kan je zo bijvoorbeeld alle beheerders met een bepaalde rol toegang geven tot een webshop, in plaats van individueel per beheerder. Als beheerders later van rol veranderen of de vereniging verlaten, hoef je enkel maar de rollen van een beheerder te wijzigen.</p>

        <STErrorsDefault :error-box="errorBox" />

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
                    <span v-if="getAdmins().length > 1" class="style-tag">
                        {{ getAdmins().length }}
                    </span>
                    <span v-else-if="getAdmins().length == 1" class="style-tag">
                        1
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
                        <span v-if="getAdminsForRole(role) > 1" class="style-tag">
                            {{ getAdminsForRole(role) }}
                        </span>
                        <span v-else-if="getAdminsForRole(role) == 1" class="style-tag">
                            1
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


<script lang="ts">
import { AutoEncoderPatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ErrorBox, LoadingView, SaveView, STErrorsDefault, STList, STListItem, Toast } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from '@stamhoofd/networking';
import { Organization, OrganizationPrivateMetaData, PermissionRole, PermissionRoleDetailed, Version } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";


import EditRoleView from "./EditRoleView.vue";

@Component({
    components: {
        STList,
        STListItem,
        LoadingView,
        SaveView,
        STErrorsDefault
    }
})
export default class AdminRolesView extends Mixins(NavigationMixin) {
    SessionManager = SessionManager // needed to make session reactive
    loading = true
    saving = false
    errorBox: ErrorBox | null = null
    patchOrganization: AutoEncoderPatchType<Organization> = Organization.patch({})

    mounted() {
        this.load(true).catch(e => {
            console.error(e)
        })

        this.setUrl("/admins/roles")
        document.title = "Stamhoofd - Beheerdersrollen"
        
        const parts = UrlHelper.shared.getParts()
        if (parts.length === 4 && parts[0] == 'settings' && parts[1] == 'admins' && parts[2] == 'roles') {
            const slug = parts[3];

            if (slug === 'new') {
                this.addRole()
            } else {
                const role = this.roles.find(r => Formatter.slug(r.name) === slug)
                if (role) {
                    this.editRole(role)
                }
            }
        }
        UrlHelper.shared.clear()
    }

    async load(force = false) {
        await this.$organizationManager.loadAdmins(force, true, this)
        this.loading = false
    }

    addPatch(patch: AutoEncoderPatchType<Organization>) {
        this.patchOrganization = this.patchOrganization.patch(patch)
    }

    get admins() {
        return this.patchedOrganization.admins ?? []
    }

    get organization() {
        return this.$organization
    }

    get patchedOrganization() {
        return this.organization.patch(this.patchOrganization)
    }

    get roles() {
        return this.patchedOrganization.privateMeta?.roles ?? []
    }

    getAdminsForRole(role: PermissionRole) {
        return this.admins.reduce((c, a) => {
            const op = a.permissions?.forOrganization(this.patchedOrganization)
            if (!!op?.roles.find(r => r.id === role.id)) {
                return c + 1
            }
            return c
        }, 0)
    }

    getAdmins() {
        // We still do a check on ID because users might have a role that is deleted
        return this.admins.filter(a => {
            const op = a.permissions?.forOrganization(this.patchedOrganization)
            return !!op?.hasFullAccess()
        })
    }

    get draggableRoles() {
        return this.patchedOrganization.privateMeta?.roles ?? [];
    }

    set draggableRoles(roles) {
        if (roles.length !== this.patchedOrganization.privateMeta?.roles?.length) {
            return;
        }

        const patch = OrganizationPrivateMetaData.patch({})
        for (const p of roles.slice().reverse()) {
            patch.roles.addMove(p.id, null)
        }
        this.addPatch(Organization.patch({ privateMeta: patch }))
    }

    roleDescription(role: PermissionRoleDetailed) {
        return role.getDescription(this.patchedOrganization.webshops, this.patchedOrganization.groups)
    }

    addRole() {
        const role = PermissionRoleDetailed.create({})
        const privateMeta = OrganizationPrivateMetaData.patch({})
        privateMeta.roles.addPut(role)

        const patch = Organization.patch({ 
            id: this.organization.id,
            privateMeta
        })
        
        this.present(new ComponentWithProperties(NavigationController, { 
            root: new ComponentWithProperties(EditRoleView, { 
                isNew: true,
                role,
                organization: this.patchedOrganization.patch(patch),
                saveHandler: (p: AutoEncoderPatchType<Organization>) => {
                    this.addPatch(patch.patch(p))
                }
            }),
        }).setDisplayStyle("popup"))
    }

    editRole(role: PermissionRoleDetailed) {
        const patch = Organization.patch({ 
            id: this.organization.id
        })
        
        this.present(new ComponentWithProperties(NavigationController, { 
            root: new ComponentWithProperties(EditRoleView, { 
                isNew: false,
                role,
                organization: this.patchedOrganization,
                saveHandler: (p: AutoEncoderPatchType<Organization>) => {
                    this.addPatch(patch.patch(p))
                }
            }),
        }).setDisplayStyle("popup"))
    }

    async save() {
        if (this.saving) {
            return;
        }

        this.saving = true

        try {
            this.patchOrganization.id = this.organization.id
            const doSave = this.patchOrganization
            await this.$organizationManager.patch(this.patchOrganization)
            this.patchOrganization = Organization.patch({ id: this.$organization.id })

            if (doSave.admins) {
                await this.load(true)
            }
            new Toast('De wijzigingen zijn opgeslagen', "success green").show()
            this.dismiss({ force: true })

        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }

        this.saving = false
    }

    get hasChanges() {
        return patchContainsChanges(this.patchOrganization, this.$organization, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true;
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

}

</script>