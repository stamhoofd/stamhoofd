<template>
    <div class="padding-group organization-switcher">
        <figure>
            <div v-if="logoSrc" class="logo">
                <img :src="logoSrc" :srcset="logoSrcSet">
            </div>
            <div v-else class="letter-logo">
                {{ organization.name.substr(0, 1) }}
            </div>
        </figure>
        <div>
            <h1 @click="switchOrganization">
                {{ organization.name }}
            </h1>
            <h2>{{ userName }}</h2>
        </div>
        <span class="icon arrow-down-small gray" />
    </div>
</template>


<script lang="ts">
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, LoadComponent, Logo, STNavigationBar, TooltipDirective } from '@stamhoofd/components';
import { SessionManager } from '@stamhoofd/networking';
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from '../../classes/OrganizationManager';


@Component({
    components: {},
    directives: {}
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

    get logoSrc() {
        if (!this.organization.meta.squareLogo) {
            return null
        }
        return this.organization.meta.squareLogo.getPathForSize(undefined, 50)
    }

    get logoSrcSet() {
        if (!this.organization.meta.squareLogo) {
            return null
        }
        return this.organization.meta.squareLogo.getPathForSize(undefined, 50) + " 1x, "+this.organization.meta.squareLogo.getPathForSize(undefined, 50*2)+" 2x, "+this.organization.meta.squareLogo.getPathForSize(undefined, 50*3)+" 3x"
    }

    switchOrganization() {
        SessionManager.deactivateSession()
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
}
</script>