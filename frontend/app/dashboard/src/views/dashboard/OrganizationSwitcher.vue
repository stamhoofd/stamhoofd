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
import { ComponentWithProperties, ModalStackComponentFinderMixin, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ContextMenu, ContextMenuItem, LoadComponent, LongPressDirective, OrganizationAvatar } from '@stamhoofd/components';
import { Session, SessionManager } from '@stamhoofd/networking';
import { Organization } from "@stamhoofd/structures";
import { Component, Mixins } from "vue-property-decorator";


import { getScopedDashboardRoot } from "../../getRootViews";

@Component({
    components: {
        OrganizationAvatar
    },
    directives: {
        LongPress: LongPressDirective
    }
})
export default class OrganizationSwitcher extends Mixins(NavigationMixin, ModalStackComponentFinderMixin) {
    SessionManager = SessionManager // needed to make session reactive

    get organization() {
        return this.$organization
    }

    get userName() {
        return this.$user ? (this.$user.firstName + ' ' + this.$user.lastName):  ""
    }

    switchOrganization() {
        this.modalStackComponent!.modalNavigationController!.popToRoot().catch(console.error)
    }

    get fullAccess() {
        return this.$user!.permissions!.hasFullAccess(this.organization.privateMeta?.roles ?? [])
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
        this.$context.logout()
    }

    availableSessions: Session[] = []
    get defaultOrganizations(): Organization[] {
        return this.availableSessions.filter(s => !!s.organization).map(s => s.organization!)
    }

    activated() {
        this.updateDefault().catch(console.error)
    }

    async updateDefault() {
        this.availableSessions = await SessionManager.availableSessions()
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
                                    SessionManager.getPreparedContextForOrganization(o).then((context) => {
                                        const nav = this.modalStackComponent
                                        if (!nav) {
                                            throw new Error("No navigation controller found")
                                        }
                                        nav.emitParents('present', {
                                            components: [
                                                getScopedDashboardRoot(context)
                                            ],
                                            animated: true,
                                            modalDisplayStyle: "popup"
                                        })


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
        menu.show({ component: this, button: this.$el as HTMLElement, xPlacement: "left", yPlacement: "bottom" }).catch(console.error)
    }
}
</script>