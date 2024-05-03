<template>
    <button v-long-press="(e) => showContextMenu(e)" class="organization-switcher" type="button" @click="showContextMenu" @contextmenu.prevent="showContextMenu">
        <OrganizationAvatar :organization="organization" />
        <div>
            <h1>
                {{ organization.name }}
            </h1>
            <h2>
                <span>Todo: naam van app</span>
                <span ref="arrow" class="icon arrow-down-small gray" />
            </h2>
        </div>
    </button>
</template>


<script lang="ts">
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ComponentWithProperties, ModalStackComponentFinderMixin, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";
import { Session, SessionManager } from '@stamhoofd/networking';
import { Organization } from "@stamhoofd/structures";
import OrganizationAvatar from "./OrganizationAvatar.vue";
import { CenteredMessage } from "./overlays/CenteredMessage";
import { ContextMenu, ContextMenuItem } from "./overlays/ContextMenu";
import OrganizationAppSelector from "./OrganizationAppSelector.vue";

@Component({
    components: {
        OrganizationAvatar
    }
})
export default class OrganizationSwitcher extends Mixins(NavigationMixin, ModalStackComponentFinderMixin) {
    get organization() {
        return this.$organization
    }

    switchOrganization() {
        this.modalStackComponent!.parentDismiss().catch(console.error)
    }

    get fullAccess() {
        return this.$user!.permissions!.hasFullAccess(this.organization.privateMeta?.roles ?? [])
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

    /*
        this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(UIFilterEditor, {
                        filter
                    })
                })
            ],
            modalDisplayStyle: 'popup',
            modalClass: 'filter-sheet'
        })
    */

    showContextMenu() {
        this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(OrganizationAppSelector, {})
                })
            ],
            modalDisplayStyle: 'popup',
            modalClass: 'positionable-sheet',
            modalCssStyle: '--sheet-position-left: 20px; --sheet-position-top: 65px; --sheet-vertical-padding: 15px;'
        })
    }

    oldshowContextMenu() {
        const menu = new ContextMenu([
            [
                new ContextMenuItem({
                    name: 'Naar ledenportaal',
                    action: async () => {
                        const nav = this.modalStackComponent
                        if (!nav) {
                            throw new Error("No modalStackComponent")
                        }
                        const registrationApp = await import("@stamhoofd/registration");

                        await nav.parentPresent({
                            components: [
                                registrationApp.getRootView(this.$context)
                            ],
                            animated: true,
                            replace: 1
                        })
                    }
                }),
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
                                    }
                                })
                            ],
                            this.defaultOrganizations.map(o => new ContextMenuItem({
                                name: o.name,
                                description: o.address.city,
                                action: async () => {
                                    const context = await SessionManager.getPreparedContextForOrganization(o)
                                    const nav = this.modalStackComponent
                                    if (!nav) {
                                        throw new Error("No modalStackComponent")
                                    }
                                    const dashboardApp = await import("@stamhoofd/dashboard");

                                    await nav.parentPresent({
                                        components: [
                                            dashboardApp.getScopedDashboardRoot(context)
                                        ],
                                        animated: true,
                                        replace: 1
                                    })
                                }
                            }))
                        ]) : undefined,
                    action: () => {
                        this.switchOrganization()
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