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

            <p class="warning-box" v-if="admins.length == 1 && enableMemberModule">
                Als je jouw wachtwoord vergeet, heb je een andere beheerder nodig om de gegevens van jouw leden terug te halen. Voe die zeker toe!
            </p>

            <Spinner v-if="loading" />
            <STList v-else>
                <STListItem v-for="admin in sortedAdmins" :key="admin.id" :selectable="true" class="right-stack right-description" @click="editAdmin(admin)">
                    <h2 class="style-title-list">{{ admin.firstName }} {{ admin.lastName }}</h2>
                    <p class="style-description-small">{{ admin.email }}</p>
                    <p class="style-description-small">{{ permissionList(admin) }}</p>

                    <template slot="right">
                        <span><span class="icon gray edit" /></span>
                    </template>
                </STListItem>

                <STListItem v-for="invite in invites" :key="invite.id" :selectable="true" class="right-stack right-description" @click="editInvite(invite)">
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
        </main>
    </div>
</template>


<script lang="ts">
import { ComponentWithProperties,NavigationMixin, NavigationController, HistoryManager } from "@simonbackx/vue-app-navigation";
import { Checkbox, STList, STListItem, STNavigationBar, STToolbar, Spinner, CenteredMessage, BackButton } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Group, GroupGenderType,GroupSettings, OrganizationPatch, User, OrganizationAdmins, Invite } from '@stamhoofd/structures';
import { OrganizationGenderType } from '@stamhoofd/structures';
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from '../../../classes/OrganizationManager';
import { Decoder } from '@simonbackx/simple-encoding';
import AdminInviteView from './AdminInviteView.vue';
import { Sorter } from "@stamhoofd/utility";

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
    admins: User[] = []
    invites: Invite[] = []

    mounted() {
        this.load().catch(e => {
            console.error(e)
        })

        HistoryManager.setUrl("/settings/admins")
        document.title = "Stamhoofd - Beheerders"
    }

    async load() {
        const session = SessionManager.currentSession!
        const response = await session.authenticatedServer.request({
            method: "GET",
            path: "/organization/admins",
            decoder: OrganizationAdmins as Decoder<OrganizationAdmins>
        })
        this.admins = response.data.users
        this.invites = response.data.invites
        this.loading = false
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
