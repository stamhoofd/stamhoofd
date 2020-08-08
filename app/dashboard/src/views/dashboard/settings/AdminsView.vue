<template>
    <div class="st-view admins-list-view">
        <STNavigationBar title="Beheerders">
            <BackButton slot="left" v-if="canPop" @click="pop"/>
            <button slot="right" class="button text" @click="createAdmin">
                <span class="icon add"/>
                <span>Nieuw</span>
            </button>
        </STNavigationBar>

    
        <main>
            <h1>Beheerders</h1>

            <Spinner v-if="loading" />
            <STList v-else>
                <STListItem v-for="admin in admins" :key="admin.id" :selectable="true" class="right-stack right-description" @click="editAdmin(admin)">
                    <h2 class="style-title-list">{{ admin.firstName }} {{ admin.lastName }}</h2>
                    <p class="style-description-small">{{ admin.email }}</p>

                    <template slot="right">
                        <span><span class="icon gray edit" /></span>
                    </template>
                </STListItem>

                <STListItem v-for="invite in invites" :key="invite.id" :selectable="true" class="right-stack right-description" @click="editInvite(invite)">
                    <h2 class="style-title-list">{{ invite.userDetails.firstName || "?" }} {{  invite.userDetails.lastName || "" }}</h2>
                    <p class="style-description-small">{{ invite.userDetails.email }}</p>

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
import { ComponentWithProperties,NavigationMixin, NavigationController } from "@simonbackx/vue-app-navigation";
import { Checkbox, STList, STListItem, STNavigationBar, STToolbar, Spinner, CenteredMessage, BackButton } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Group, GroupGenderType,GroupSettings, OrganizationPatch, User, OrganizationAdmins, Invite } from '@stamhoofd/structures';
import { OrganizationGenderType } from '@stamhoofd/structures';
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from '../../../classes/OrganizationManager';
import { Decoder } from '@simonbackx/simple-encoding';
import AdminInviteView from './AdminInviteView.vue';

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
                    console.log(i)

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
                    console.log(i)

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
