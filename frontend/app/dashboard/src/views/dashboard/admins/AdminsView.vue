<template>
    <div class="st-view background">
        <STNavigationBar title="Beheerders" :dismiss="canDismiss" :pop="canPop">
            <button slot="right" class="button text only-icon-smartphone" aria-label="Nieuwe beheerder" type="button" @click="createAdmin">
                <span class="icon add" />
                <span>Beheerder</span>
            </button>
        </STNavigationBar>

    
        <main>
            <h1>Beheerders</h1>
            <p>Voeg hier beheerders toe en geef iedereen toegang tot bepaalde onderdelen door functies toe te kennen. Een beheerder kan meerdere functies hebben. Maak zelf nieuwe functies aan en stel de toegang in per functie.</p>

            <Spinner v-if="loading" />

            <template v-else>
                <STList>
                    <STListItem v-for="admin in sortedAdmins" :key="admin.id" :selectable="true" class="right-stack" @click="editAdmin(admin)">
                        <template slot="left">
                            <span v-if="hasFullAccess(admin)" vv-tooltip="'Hoofdbeheerder'" class="icon layered">
                                <span class="icon user-admin-layer-1" />
                                <span class="icon user-admin-layer-2 yellow" />
                            </span>
                            <span v-else-if="hasNoRoles(admin)" v-tooltip="'Heeft geen functies'" class="icon layered">
                                <span class="icon user-blocked-layer-1" />
                                <span class="icon user-blocked-layer-2 error" />
                            </span>
                            <span v-else class="icon user" />
                        </template>

                        <h2 class="style-title-list">
                            <span>{{ admin.firstName }} {{ admin.lastName }}</span>
                        </h2>
                        <p class="style-description-small">
                            {{ admin.email }}
                        </p>
                        <p class="style-description-small">
                            {{ permissionList(admin) }}
                        </p>

                        <template slot="right">
                            <span v-if="admin.id === me.id" class="style-tag">
                                Ik
                            </span>
                            <span v-else-if="!admin.hasAccount" v-tooltip="'Uitnodiging nog niet geaccepteerd'" class="icon email gray" />
                            <span><span class="icon gray edit" /></span>
                        </template>
                    </STListItem>
                </STList>

                <hr>

                <p>
                    <button class="button text" type="button" @click="addRole">
                        <span class="icon add" />
                        <span>Nieuwe functie toevoegen</span>
                    </button>
                </p>
                <p>
                    <button class="button text" type="button" @click="createAdmin">
                        <span class="icon add" />
                        <span>Nieuwe beheerder toevoegen</span>
                    </button>
                </p>
            </template>
        </main>
    </div>
</template>


<script lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, Spinner, STList, STListItem, STNavigationBar, STToolbar, Toast, TooltipDirective } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from '@stamhoofd/networking';
import { Organization, OrganizationPrivateMetaData, PermissionLevel, PermissionRole, PermissionRoleDetailed, Permissions, User } from '@stamhoofd/structures';
import { Sorter } from "@stamhoofd/utility";
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from '../../../classes/OrganizationManager';
import AdminView from './AdminView.vue';
import EditRoleView from "./EditRoleView.vue";

@Component({
    components: {
        Checkbox,
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Spinner,
        BackButton
    },
    directives: {
        tooltip: TooltipDirective
    }
})
export default class AdminsView extends Mixins(NavigationMixin) {
    SessionManager = SessionManager // needed to make session reactive
    loading = true

    mounted() {
        this.load(true).catch(e => {
            console.error(e)
        })

        UrlHelper.setUrl("/settings/admins")
        document.title = "Stamhoofd - Beheerders"
    }

    async load(force = false) {
        await OrganizationManager.loadAdmins(force, true, this)
        this.loading = false
    }

    beforeDestroy() {
        // Clear all pending requests
        Request.cancelAll(this)
    }

    get admins() {
        return this.organization.admins ?? []
    }

    get organization() {
        return OrganizationManager.organization
    }

    get enableMemberModule() {
        return this.organization.meta.modules.useMembers
    }

    get me() {
        return this.SessionManager.currentSession!.user
    }

    permissionList(user: User) {
        const list: string[] = []
        if (user.permissions?.hasFullAccess()) {
            list.push("Hoofdbeheerders")
        }

        for (const role of user.permissions?.roles ?? []) {
            list.push(role.name)
        }
        return list.join(", ")
    }

    get roles() {
        return this.organization.privateMeta?.roles ?? []
    }

    get sortedAdmins() {
        return this.admins.slice().sort((a, b) => Sorter.stack(Sorter.byBooleanValue(a.permissions?.hasFullAccess() ?? false, b.permissions?.hasFullAccess() ?? false), Sorter.byStringValue(a.firstName+" "+a.lastName, b.firstName+" "+b.lastName)))
    }

    hasFullAccess(user: User) {
        return user.permissions?.hasFullAccess() ?? false
    }

    hasNoRoles(user: User) {
        return !user.permissions?.hasReadAccess() && user.permissions?.roles.length == 0
    }

    createAdmin() {
        this.present(new ComponentWithProperties(NavigationController, { 
            root: new ComponentWithProperties(AdminView, {
                user: User.create({
                    email: '',
                    permissions: Permissions.create({ level: PermissionLevel.None })
                }),
                isNew: true
            }) 
        }).setDisplayStyle("popup"))
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

    editAdmin(admin: User) {
        this.present(new ComponentWithProperties(NavigationController, { 
            root: new ComponentWithProperties(AdminView, { 
                user: admin,
                isNew: false
            })
        }).setDisplayStyle("popup"))
    }

    getAdminsForRole(role: PermissionRole) {
        return this.sortedAdmins.filter(a => !!a.permissions?.roles.find(r => r.id === role.id))
    }

    getAdminsWithoutRole() {
        // We still do a check on ID because users might have a role that is deleted
        const ids = this.roles.map(r => r.id)
        return this.sortedAdmins.filter(a => !a.permissions?.hasFullAccess() && !a.permissions?.roles.find(r => ids.includes(r.id)))
    }

    getAdmins() {
        // We still do a check on ID because users might have a role that is deleted
        return this.sortedAdmins.filter(a => !!a.permissions?.hasFullAccess())
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