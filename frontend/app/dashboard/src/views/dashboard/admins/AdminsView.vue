<template>
    <div class="st-view admins-list-view">
        <STNavigationBar title="Beheerders">
            <button slot="right" class="button text" @click="createAdmin">
                <span class="icon add"/>
                <span>Nieuw</span>
            </button>

            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else slot="right" class="button icon close gray" @click="pop" />
        </STNavigationBar>

    
        <main>
            <h1>Beheerders</h1>
            <p>Voeg hier beheerders toe en deel ze op in rollen. Een beheerder kan meerdere rollen hebben. Je kan vervolgens de toegang tot zaken regelen per rol.</p>

            <p class="error-box" v-if="admins.length == 1 && enableMemberModule">
                Als je jouw wachtwoord vergeet, heb je een andere beheerder nodig om de gegevens van jouw leden terug te halen. Voe die zeker toe en zorg dat de uitnodiging geaccepteerd wordt, want die vervalt!
            </p>

            <Spinner v-if="loading" />
            
            <hr>
            <h2>
                Administrators
            </h2>
            <p>Administrators hebben toegang tot alles, zonder beperkingen.</p>

            <Spinner v-if="loading" />
                <STList v-else>
                    <STListItem v-for="admin in getAdmins()" :key="admin.id" :selectable="true" class="right-stack right-description" @click="editAdmin(admin)">
                        <h2 class="style-title-list">{{ admin.firstName }} {{ admin.lastName }}</h2>
                        <p class="style-description-small">{{ admin.email }}</p>
                        <p class="style-description-small">{{ permissionList(admin) }}</p>

                        <template slot="right">
                            <span><span class="icon gray edit" /></span>
                        </template>
                    </STListItem>

                    <STListItem v-for="invite in getInviteAdmins()" :key="invite.id" :selectable="true" class="right-stack right-description" @click="editInvite(invite)">
                        <h2 class="style-title-list">{{ invite.userDetails.firstName || "?" }} {{  invite.userDetails.lastName || "" }}</h2>
                        <p class="style-description-small">{{ invite.userDetails.email }}</p>
                        <p class="style-description-small">{{ permissionList(invite) }}</p>

                        <template slot="right">
                            <p v-if="isExpired(invite)">Uitnodiging vervallen</p>
                            <p v-else>Uitnodiging nog niet geaccepteerd</p>
                            <span><span class="icon gray edit" /></span>
                        </template>
                    </STListItem>
                </STList>

            <div v-for="role in roles" class="container">
                <hr>
                <h2 class="style-with-button">
                    <div>
                        {{ role.name }}
                    </div>
                    <div>
                        <button class="button text" @click="editRole(role)">
                            <span class="icon settings"/>
                            <span>Bewerken</span>
                        </button>
                    </div>
                </h2>

                <Spinner v-if="loading" />
                <STList v-else>
                    <STListItem v-for="admin in getAdminsForRole(role)" :key="admin.id" :selectable="true" class="right-stack right-description" @click="editAdmin(admin)">
                        <h2 class="style-title-list">{{ admin.firstName }} {{ admin.lastName }}</h2>
                        <p class="style-description-small">{{ admin.email }}</p>
                        <p class="style-description-small">{{ permissionList(admin) }}</p>

                        <template slot="right">
                            <span><span class="icon gray edit" /></span>
                        </template>
                    </STListItem>

                    <STListItem v-for="invite in getInvitesForRole(role)" :key="invite.id" :selectable="true" class="right-stack right-description" @click="editInvite(invite)">
                        <h2 class="style-title-list">{{ invite.userDetails.firstName || "?" }} {{  invite.userDetails.lastName || "" }}</h2>
                        <p class="style-description-small">{{ invite.userDetails.email }}</p>
                        <p class="style-description-small">{{ permissionList(invite) }}</p>

                        <template slot="right">
                            <p v-if="isExpired(invite)">Uitnodiging vervallen</p>
                            <p v-else>Uitnodiging nog niet geaccepteerd</p>
                            <span><span class="icon gray edit" /></span>
                        </template>
                    </STListItem>
                </STList>

                <p class="info-box" v-if="getAdminsForRole(role).length + getInvitesForRole(role).length == 0">Geen beheerders met deze rol</p>
            </div>

            <div class="container" v-if="getAdminsWithoutRole().length > 0 || getInvitesWithoutRole().length > 0">
                <hr>
                    <h2 class="style-with-button">
                    <div>
                        Beheerders zonder rollen
                    </div>
                </h2>

                <STList v-if="!loading">
                    <STListItem v-for="admin in getAdminsWithoutRole()" :key="admin.id" :selectable="true" class="right-stack right-description" @click="editAdmin(admin)">
                        <h2 class="style-title-list">{{ admin.firstName }} {{ admin.lastName }}</h2>
                        <p class="style-description-small">{{ admin.email }}</p>
                        <p class="style-description-small">{{ permissionList(admin) }}</p>

                        <template slot="right">
                            <span><span class="icon gray edit" /></span>
                        </template>
                    </STListItem>

                    <STListItem v-for="invite in getInvitesWithoutRole()" :key="invite.id" :selectable="true" class="right-stack right-description" @click="editInvite(invite)">
                        <h2 class="style-title-list">{{ invite.userDetails.firstName || "?" }} {{  invite.userDetails.lastName || "" }}</h2>
                        <p class="style-description-small">{{ invite.userDetails.email }}</p>
                        <p class="style-description-small">{{ permissionList(invite) }}</p>

                        <template slot="right">
                            <p v-if="isExpired(invite)">Uitnodiging vervallen</p>
                            <p v-else>Uitnodiging nog niet geaccepteerd</p>
                            <span><span class="icon gray edit" /></span>
                        </template>
                    </STListItem>
                </STList>
            </div>

            <p>
                <button class="button text" @click="addRole">
                    <span class="icon add"/>
                    <span>Nieuwe rol toevoegen</span>
                </button>
            </p>
            <p>
                <button class="button text" @click="createAdmin">
                    <span class="icon add"/>
                    <span>Nieuwe beheerder toevoegen</span>
                </button>
            </p>
        </main>
    </div>
</template>


<script lang="ts">
import { ComponentWithProperties,NavigationMixin, NavigationController, HistoryManager } from "@simonbackx/vue-app-navigation";
import { Checkbox, STList, STListItem, STNavigationBar, STToolbar, Spinner, CenteredMessage, BackButton } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Group, GroupGenderType,GroupSettings, OrganizationPatch, User, OrganizationAdmins, Invite, PermissionRoleDetailed, Organization, OrganizationPrivateMetaData } from '@stamhoofd/structures';
import { OrganizationGenderType } from '@stamhoofd/structures';
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from '../../../classes/OrganizationManager';
import { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import AdminInviteView from './AdminInviteView.vue';
import { Sorter } from "@stamhoofd/utility";
import EditRoleView from "./EditRoleView.vue";
import { PermissionRole } from "@stamhoofd/structures";

@Component({
    components: {
        Checkbox,
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Spinner,
        BackButton
    }
})
export default class AdminsView extends Mixins(NavigationMixin) {
    SessionManager = SessionManager // needed to make session reactive
    loading = true

    mounted() {
        this.load(true).catch(e => {
            console.error(e)
        })

        HistoryManager.setUrl("/settings/admins")
        document.title = "Stamhoofd - Beheerders"
    }

    async load(force = false) {
        if (!force && this.organization.admins && this.organization.invites) {
            this.loading = false
            return
        }

        const session = SessionManager.currentSession!
        const response = await session.authenticatedServer.request({
            method: "GET",
            path: "/organization/admins",
            decoder: OrganizationAdmins as Decoder<OrganizationAdmins>
        })

        this.organization.admins = response.data.users
        this.organization.invites = response.data.invites
        this.loading = false
    }

    get admins() {
        return this.organization.admins ?? []
    }

    get invites() {
        return this.organization.invites ?? []
    }

    get organization() {
        return OrganizationManager.organization
    }

    get enableMemberModule() {
        return this.organization.meta.modules.useMembers
    }

    permissionList(user: User | Invite) {
        if (user.permissions?.hasFullAccess()) {
            return "Administrator"
        }

        if (user.permissions?.hasWriteAccess()) {
            return "Alle groepen"
        }

        const list: string[] = []

        for (const group of this.organization.groups) {
            if (user.permissions?.hasWriteAccess(group.id)) {
                list.push(group.settings.name)
            }
        }

        if (list.length == this.organization.groups.length) {
            return "Alle groepen"
        }

        return list.join(", ")
    }

    get roles() {
        return this.organization.privateMeta?.roles ?? []
    }

    get sortedAdmins() {
        return this.admins.sort((a, b) => {
            const af = a.permissions?.hasFullAccess() ?? false
            const bf = b.permissions?.hasFullAccess() ?? false

            const ag = this.organization.groups.filter(g => a.permissions?.hasWriteAccess(g.id)) ?? []
            const bg = this.organization.groups.filter(g => b.permissions?.hasWriteAccess(g.id)) ?? []

            const ac = ag.length
            const bc = bg.length

            return Sorter.stack(
                Sorter.byBooleanValue(af, bf), 
                Sorter.byNumberValue(ac, bc), 
                ac == 1 && bc == 1 ? Group.defaultSort(ag[0], bg[0]) : 0,
                Sorter.byStringValue(a.firstName ?? "", b.firstName ?? ""),
                Sorter.byStringValue(a.lastName ?? "", b.lastName ?? "")
            )!
        })
    }

    createAdmin() {
        this.present(new ComponentWithProperties(NavigationController, { 
            root: new ComponentWithProperties(AdminInviteView, {
                onUpdateInvite: (patched: Invite | null) => {
                    if (patched) {
                        this.invites.push(patched)
                    }
                }
            }) 
        }).setDisplayStyle("popup"))
    }

    isExpired(invite: Invite) {
        return invite.validUntil.getTime() < new Date().getTime()+10*1000
    }

    editAdmin(admin: User) {
       this.present(new ComponentWithProperties(NavigationController, { 
            root: new ComponentWithProperties(AdminInviteView, { 
                editUser: admin,
                onUpdateUser: (patched: User | null) => {
                    const i = this.admins.findIndex(a => a.id === admin.id)

                    if (i != -1) {
                        this.admins.splice(i, 1, ...patched ? [patched] : [])
                    }
                    
                }
            }) ,
            
        }).setDisplayStyle("popup"))
    }

    getAdminsForRole(role: PermissionRole) {
        return this.sortedAdmins.filter(a => !!a.permissions?.roles.find(r => r.id === role.id))
    }

    getInvitesForRole(role: PermissionRole) {
        return this.invites.filter(a => !!a.permissions?.roles.find(r => r.id === role.id))
    }

    getAdminsWithoutRole() {
        // We still do a check on ID because users might have a role that is deleted
        const ids = this.roles.map(r => r.id)
        return this.sortedAdmins.filter(a => !a.permissions?.hasFullAccess() && !a.permissions?.roles.find(r => ids.includes(r.id)))
    }

    getInvitesWithoutRole() {
        // We still do a check on ID because users might have a role that is deleted
        const ids = this.roles.map(r => r.id)
        return this.invites.filter(a => !a.permissions?.hasFullAccess() && !a.permissions?.roles.find(r => ids.includes(r.id)))
    }

    getAdmins() {
        // We still do a check on ID because users might have a role that is deleted
        return this.sortedAdmins.filter(a => !!a.permissions?.hasFullAccess())
    }

    getInviteAdmins() {
        // We still do a check on ID because users might have a role that is deleted
        return this.invites.filter(a => !!a.permissions?.hasFullAccess())
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
                async saveHandler(p: AutoEncoderPatchType<Organization>) {
                    const doSave = patch.patch(p)
                    await OrganizationManager.patch(doSave)
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
                async saveHandler(p: AutoEncoderPatchType<Organization>) {
                    const doSave = patch.patch(p)
                    await OrganizationManager.patch(doSave)
                    if (p.admins || p.invites) {
                        await this.load(true)
                    }
                }
            }),
        }).setDisplayStyle("popup"))
    }

    editInvite(invite: Invite) {
       this.present(new ComponentWithProperties(NavigationController, { 
            root: new ComponentWithProperties(AdminInviteView, { 
                editInvite: invite,
                onUpdateInvite: (patched: Invite | null) => {
                    const i = this.invites.findIndex(a => a.id === invite.id)

                    if (i != -1) {
                        this.invites.splice(i, 1, ...patched ? [patched] : [])
                    } else {
                        // Create the invite (it has been regenerated)
                        if (patched) {
                            this.invites.push(patched)
                        }
                    }
                }
            }),
        }).setDisplayStyle("popup"))
    }
}

</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

.admins-list-view {
    background: $color-white;
}
</style>
