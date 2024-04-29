<template>
    <LoadingView v-if="loading" />
    <div v-else class="st-view background">
        <STNavigationBar title="Beheerders" :dismiss="canDismiss" :pop="canPop">
            <button slot="right" class="button text only-icon-smartphone" aria-label="Nieuwe beheerder" type="button" @click="createAdmin">
                <span class="icon add" />
                <span>Beheerder</span>
            </button>
        </STNavigationBar>

    
        <main>
            <h1>Beheerders</h1>
            <p>Voeg hier beheerders toe en regel wat ze kunnen doen in Stamhoofd door rollen toe te kennen. Maak zelf nieuwe rollen aan en stel de rechten in per rol.</p>


            <STList class="illustration-list">    
                <STListItem :selectable="true" class="left-center" @click="createAdmin">
                    <template #left><img src="@stamhoofd/assets/images/illustrations/account-add.svg"></template>
                    <h2 class="style-title-list">
                        Nieuwe beheerder
                    </h2>
                    <p class="style-description">
                        Nodig iemand uit om beheerder te worden.
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="editRoles(true)">
                    <template #left><img src="@stamhoofd/assets/images/illustrations/admin-role.svg"></template>
                    <h2 class="style-title-list">
                        Rollen beheren
                    </h2>
                    <p class="style-description">
                        Maak rollen die je aan beheerders kan toekennen.
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <hr>
            <h2>Alle beheerders</h2>
            <STList>
                <STListItem v-for="admin in sortedAdmins" :key="admin.id" :selectable="true" class="right-stack" @click="editAdmin(admin)">
                    <template #left>
                        <span v-if="hasFullAccess(admin)" v-tooltip="'Hoofdbeheerder'" class="icon layered">
                            <span class="icon user-admin-layer-1" />
                            <span class="icon user-admin-layer-2 yellow" />
                        </span>
                        <span v-else-if="hasNoRoles(admin)" v-tooltip="'Heeft geen rol'" class="icon layered">
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

                    <template #right>
                        <span v-if="admin.id === me.id" class="style-tag">
                            Ik
                        </span>
                        <span v-else-if="!admin.hasAccount" v-tooltip="'Uitnodiging nog niet geaccepteerd'" class="icon email gray" />
                        <span><span class="icon gray edit" /></span>
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>


<script lang="ts">
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, LoadingView, STList, STListItem, STNavigationBar, STToolbar, Toast, TooltipDirective } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from '@stamhoofd/networking';
import { Organization, OrganizationPrivateMetaData, PermissionLevel, PermissionRole, PermissionRoleDetailed, Permissions, User } from '@stamhoofd/structures';
import { Sorter } from "@stamhoofd/utility";
import { Component, Mixins } from "vue-property-decorator";


import AdminRolesView from './AdminRolesView.vue';
import AdminView from './AdminView.vue';

@Component({
    components: {
        Checkbox,
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        LoadingView,
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
        const parts = UrlHelper.shared.getParts()

        this.load(true).catch(e => {
            console.error(e)
        })

        UrlHelper.setUrl("/settings/admins")
        document.title = "Stamhoofd - Beheerders"

        if (parts.length >= 3 && parts[0] == 'settings' && parts[1] == 'admins' && parts[2] == 'roles') {
            this.editRoles(false)
        } else {
            UrlHelper.shared.clear()
        }
        
    }

    async load(force = false) {
        await this.$organizationManager.loadAdmins(force, true, this)
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
        return this.$organization
    }

    get enableMemberModule() {
        return this.organization.meta.modules.useMembers
    }

    get me() {
        return this.$context.user
    }

    permissionList(user: User) {
        const list: string[] = []
        if (user.permissions?.hasFullAccess(this.organization.privateMeta?.roles ?? [])) {
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
        return this.admins.slice().sort((a, b) => Sorter.stack(Sorter.byBooleanValue(a.permissions?.hasFullAccess(this.organization.privateMeta?.roles ?? []) ?? false, b.permissions?.hasFullAccess(this.organization.privateMeta?.roles ?? []) ?? false), Sorter.byStringValue(a.firstName+" "+a.lastName, b.firstName+" "+b.lastName)))
    }

    hasFullAccess(user: User) {
        return user.permissions?.hasFullAccess(this.organization.privateMeta?.roles ?? []) ?? false
    }

    hasNoRoles(user: User) {
        return !user.permissions?.hasReadAccess(this.organization.privateMeta?.roles ?? []) && user.permissions?.roles.length == 0
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
        this.$organizationManager.patch(patch).catch(e => Toast.fromError(e).show())
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
        this.$organizationManager.patch(patch).catch(e => Toast.fromError(e).show())
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
        return this.sortedAdmins.filter(a => !a.permissions?.hasFullAccess(this.organization.privateMeta?.roles ?? []) && !a.permissions?.roles.find(r => ids.includes(r.id)))
    }

    getAdmins() {
        // We still do a check on ID because users might have a role that is deleted
        return this.sortedAdmins.filter(a => !!a.permissions?.hasFullAccess(this.organization.privateMeta?.roles ?? []))
    }

    editRoles(animated = true) {
        this.present({
            components: [
                new ComponentWithProperties(NavigationController, { 
                    root: new ComponentWithProperties(AdminRolesView, {}),
                })
            ],
            modalDisplayStyle: 'popup',
            animated
        })
    }
}

</script>