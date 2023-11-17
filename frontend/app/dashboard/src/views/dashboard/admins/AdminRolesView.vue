<template>
    <LoadingView v-if="loading" />
    <div v-else class="st-view background">
        <STNavigationBar title="Functies" :dismiss="canDismiss" :pop="canPop">
            <button slot="right" class="button icon add" aria-label="Nieuwe beheerder" type="button" @click="addRole" />
        </STNavigationBar>

    
        <main>
            <h1>Beheerder functies</h1>
            <p>Voeg hier beheerders toe en deel ze op in groepen. Een beheerder kan in meerdere groepen zitten. Je kan vervolgens de toegang tot zaken regelen per groep.</p>

            <STList>
                <STListItem>
                    <h2 class="style-title-list">
                        Hoofdbeheerder
                    </h2>
                    <p class="style-description-small">
                        Toegang tot alles
                    </p>

                    <template slot="right">
                        <span v-if="getAdmins(role).length > 1" class="style-tag">
                            {{ getAdmins(role).length }}
                        </span>
                        <span v-else-if="getAdminsForRole(role).length == 1" class="style-tag">
                            1
                        </span>
                        <span><span class="icon gray edit" /></span>
                    </template>
                </STListItem>
                <STListItem v-for="(role, index) in roles" :key="role.id" :selectable="true" class="right-stack" @click="editRole(admin)">
                    <h2 class="style-title-list">
                        {{ role.name }}
                    </h2>
                    <p class="style-description-small">
                        Beschrijving (todo)
                    </p>

                    <template slot="right">
                        <span v-if="getAdminsForRole(role).length > 1" class="style-tag">
                            {{ getAdminsForRole(role).length }}
                        </span>
                        <span v-else-if="getAdminsForRole(role).length == 1" class="style-tag">
                            1
                        </span>
                        <span v-else class="style-tag warn">
                            -
                        </span>
                        <span><span class="icon gray edit" /></span>
                    </template>
                </STListItem>
            </stlist>
        </main>
    </div>
    </loadingview>
</template>


<script lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, LoadingView, STList, STListItem, STNavigationBar, STToolbar, Toast } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from '@stamhoofd/networking';
import { Organization, OrganizationPrivateMetaData, PermissionRole, PermissionRoleDetailed } from '@stamhoofd/structures';
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from '../../../classes/OrganizationManager';
import EditRoleView from "./EditRoleView.vue";

@Component({
    components: {
        Checkbox,
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        LoadingView,
        BackButton
    }
})
export default class AdminRolesView extends Mixins(NavigationMixin) {
    SessionManager = SessionManager // needed to make session reactive
    loading = true

    mounted() {
        this.load(true).catch(e => {
            console.error(e)
        })

        UrlHelper.setUrl("/settings/admins/roles")
        document.title = "Stamhoofd - Beheerderfuncties"
    }

    async load(force = false) {
        await OrganizationManager.loadAdmins(force, true, this)
        this.loading = false
    }

    get admins() {
        return this.organization.admins ?? []
    }

    get organization() {
        return OrganizationManager.organization
    }

    get roles() {
        return this.organization.privateMeta?.roles ?? []
    }

    moveRoleUp(index: number, role: PermissionRoleDetailed) {
        if (index == 0) {
            return
        }
        const prev = this.roles[index - 2]?.id
        const privateMeta = OrganizationPrivateMetaData.patch({})
        privateMeta.roles.addMove(role.id, prev ?? null)
        const patch = Organization.patch({
            id: this.organization.id,
            privateMeta
        })
        OrganizationManager.patch(patch).catch(e => Toast.fromError(e).show())
    }

    moveRoleDown(index: number, role: PermissionRoleDetailed) {
        if (index >= this.roles.length - 1) {
            return
        }
        const prev = this.roles[index + 1]?.id
        const privateMeta = OrganizationPrivateMetaData.patch({})
        privateMeta.roles.addMove(role.id, prev ?? null)
        const patch = Organization.patch({
            id: this.organization.id,
            privateMeta
        })
        OrganizationManager.patch(patch).catch(e => Toast.fromError(e).show())
    }

    getAdminsForRole(role: PermissionRole) {
        return this.admins.filter(a => !!a.permissions?.roles.find(r => r.id === role.id))
    }

    getAdmins() {
        // We still do a check on ID because users might have a role that is deleted
        return this.admins.filter(a => !!a.permissions?.hasFullAccess())
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
                role,
                organization: this.organization.patch(patch),
                saveHandler: async (p: AutoEncoderPatchType<Organization>) => {
                    const doSave = patch.patch(p)
                    await OrganizationManager.patch(doSave)
                    if (doSave.admins) {
                        await this.load(true)
                    }
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
                role,
                organization: this.organization,
                saveHandler: async (p: AutoEncoderPatchType<Organization>) => {
                    const doSave = patch.patch(p)
                    await OrganizationManager.patch(doSave)
                    if (doSave.admins) {
                        await this.load(true)
                    }
                }
            }),
        }).setDisplayStyle("popup"))
    }
}

</script>