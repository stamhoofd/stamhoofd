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
import { ComponentWithProperties, HistoryManager, ModalStackComponentFinderMixin, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
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

    showContextMenu() {
        this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(OrganizationAppSelector, {})
                }, {
                    provide: {
                        reactive_navigation_disable_url: true
                    }
                })
            ],
            modalDisplayStyle: 'popup',
            modalClass: 'positionable-sheet',
            modalCssStyle: '--sheet-position-left: 20px; --sheet-position-top: 65px; --sheet-vertical-padding: 15px;',
            
        })
    }
}
</script>