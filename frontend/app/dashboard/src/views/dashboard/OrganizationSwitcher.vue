<template>
    <button v-long-press="(e) => showContextMenu(e)" class="organization-switcher" type="button" @click="showContextMenu" @contextmenu.prevent="showContextMenu">
        <OrganizationAvatar :organization="organization" />
        <div>
            <h1>
                {{ organization.name }}
            </h1>
            <h2>
                <span>{{ userName }}</span>
                <span ref="arrow" class="icon arrow-down-small gray" />
            </h2>
        </div>
    </button>
</template>


<script lang="ts">
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ContextMenu, ContextMenuItem, LoadComponent, LongPressDirective,OrganizationAvatar } from '@stamhoofd/components';
import { Session, SessionManager } from '@stamhoofd/networking';
import { Organization } from "@stamhoofd/structures";
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from '../../classes/OrganizationManager';

@Component({
    components: {
        OrganizationAvatar
    },
    directives: {
        LongPress: LongPressDirective
    }
})
export default class OrganizationSwitcher extends Mixins(NavigationMixin) {
    SessionManager = SessionManager // needed to make session reactive
    OrganizationManager = OrganizationManager

    get organization() {
        return OrganizationManager.organization
    }

    get userName() {
        return SessionManager.currentSession?.user ? (SessionManager.currentSession.user.firstName + ' ' + SessionManager.currentSession.user.lastName):  ""
    }

    switchOrganization() {
        SessionManager.deactivateSession()
    }

    get fullAccess() {
        return SessionManager.currentSession!.user!.permissions!.hasFullAccess(this.organization.privateMeta?.roles ?? [])
    }

    async manageSettings(animated = true) {
        //this.currentlySelected = "manage-settings"
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.showDetail({
            adjustHistory: animated,
            animated,
            components: [
                new ComponentWithProperties(NavigationController, { 
                    root: await LoadComponent(() => import(/* webpackChunkName: "SettingsView", webpackPrefetch: true */ './settings/SettingsView.vue'), {}, { instant: !animated })
                })
            ],
        });
    }

    async manageAccount(animated = true) {
        //this.currentlySelected = "manage-account"
        this.showDetail({
            adjustHistory: animated,
            animated,
            components: [
                new ComponentWithProperties(NavigationController, { 
                    root: await LoadComponent(() => import(/* webpackChunkName: "AccountSettingsView", webpackPrefetch: true */ './account/AccountSettingsView.vue'), {}, { instant: !animated })
                })
            ]
        });
    }

    async logout() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je wilt uitloggen?", "Uitloggen")) {
            return;
        }
        SessionManager.logout()
    }

    availableSessions: Session[] = []
    get defaultOrganizations(): Organization[] {
        return this.availableSessions.filter(s => !!s.organization).map(s => s.organization!)
    }

    activated() {
        this.updateDefault().catch(console.error)
    }

    async updateDefault() {
        this.availableSessions = (await SessionManager.availableSessions()).slice(0, 10)
    }

    showContextMenu(event) {
        const menu = new ContextMenu([
            [
                new ContextMenuItem({
                    name: "Mijn account",
                    icon: "user",
                    action: () => {
                        this.manageAccount().catch(console.error)
                        return true;
                    }
                }),

                ...(this.fullAccess ? [new ContextMenuItem({
                    name: "Instellingen",
                    icon: "settings",
                    action: () => {
                        this.manageSettings().catch(console.error)
                        return true;
                    }
                })] : []),
            ],
            [
                new ContextMenuItem({
                    name: "Wissel tussen vereniging",
                    icon: "sync",
                    childMenu: this.defaultOrganizations.length > 1 ? 
                        new ContextMenu([
                            [
                                new ContextMenuItem({
                                    name: "Zoek vereniging",
                                    icon: "search",
                                    action: () => {
                                        this.switchOrganization()
                                        return true;
                                    }
                                })
                            ],
                            this.defaultOrganizations.map(o => new ContextMenuItem({
                                name: o.name,
                                description: o.address.city,
                                action: () => {
                                    OrganizationManager.switchOrganization(this, o.id).then(() => {
                                        this.updateDefault().catch(console.error)
                                    }).catch(console.error)
                                    return true;
                                }
                            }))
                        ]) : undefined,
                    action: () => {
                        this.switchOrganization()
                        return true;
                    }
                }),
                new ContextMenuItem({
                    name: "Uitloggen",
                    icon: "logout",
                    action: () => {
                        this.logout().catch(console.error)
                        return true;
                    }
                }),
            ]
        ])
        menu.show({ button: this.$el as HTMLElement, xPlacement: "left", yPlacement: "bottom" }).catch(console.error)
    }
}
</script>