<template>
    <div class="st-menu st-view">
        <main>
            <div class="padding-group">
                <Logo />
                <span class="logo-text vertical">Administratie</span>
            </div>
  

            <hr>

            <button class="menu-button button heading" :class="{ selected: currentlySelected == 'organizations'}" type="button" @click="openOrganizations(true)"> 
                <span class="icon group" />
                <span>Verenigingen</span>
            </button>

            <button class="menu-button button heading" :class="{ selected: currentlySelected == 'members'}" type="button" @click="openMembers(true)"> 
                <span class="icon user" />
                <span>Alle leden</span>
            </button>

            <hr>


            <button class="menu-button button heading" :class="{ selected: currentlySelected == 'invoices'}" type="button" @click="openInvoices(true)"> 
                <span class="icon file-filled" />
                <span>Facturen</span>
            </button>

            <button class="menu-button button heading" :class="{ selected: currentlySelected == 'pending-invoices'}" type="button" @click="openPendingInvoices(true)"> 
                <span class="icon card" />
                <span>Openstaande bedragen</span>
            </button>

            <button class="menu-button button heading" :class="{ selected: currentlySelected == 'statistics'}" type="button" @click="openStatistics(true)"> 
                <span class="icon stats" />
                <span>Statistieken</span>
            </button>

            <hr>

            <button class="menu-button button heading" :class="{ selected: currentlySelected == 'account'}" type="button" @click="openAccount(true)"> 
                <span class="icon user" />
                <span>Mijn account</span>
            </button>

            <button class="menu-button button heading" :class="{ selected: currentlySelected == 'settings'}" type="button" @click="openSettings(true)"> 
                <span class="icon settings" />
                <span>Instellingen</span>
            </button>

            <hr>
            <div class>
                <button class="menu-button button heading" type="button" @click="logout">
                    <span class="icon logout" />
                    <span>Uitloggen</span>
                </button>
            </div>
        </main>
    </div>
</template>

<script lang="ts">
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Logo } from '@stamhoofd/components';
import { UrlHelper } from "@stamhoofd/networking";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";

import { AdminSession } from "../classes/AdminSession";
import AccountSettingsView from "./account/AccountSettingsView.vue";
import EditEmailTemplatesView from "./email-templates/EditEmailTemplatesView.vue";
import InvoicesView from "./invoices/InvoicesView.vue";
import MembersView from "./members/MembersView.vue";
import OrganizationsView from "./organizations/OrganizationsView.vue";
import PendingInvoicesView from "./pending-invoices/PendingInvoicesView.vue";
import SettingsView from "./settings/SettingsView.vue";
import StatisticsView from "./statistics/StatisticsView.vue";

@Component({
    components: {
        Logo
    }
})
export default class AdminMenu extends Mixins(NavigationMixin) {
    currentlySelected: string | null = null;

    mounted() {
        const parts = UrlHelper.shared.getParts()
        UrlHelper.setUrl("/")

        let didSet = false

        if (parts.length == 1 && parts[0] == 'invoices') {
            didSet = true
            this.openInvoices(false)
        }

        if (parts.length == 1 && parts[0] == 'pending-invoices') {
            didSet = true
            this.openPendingInvoices(false)
        }

        if (parts.length == 1 && parts[0] == 'statistics') {
            didSet = true
            this.openStatistics(false)
        }

        if (parts.length == 1 && parts[0] == 'organizations') {
            didSet = true
            this.openOrganizations(false)
        }

        if (parts.length == 1 && parts[0] == 'members') {
            didSet = true
            this.openMembers(false)
        }

        if (parts.length == 1 && parts[0] == 'account') {
            didSet = true
            this.openAccount(false)
        }

        if (parts.length >= 1 && parts[0] == 'settings') {
            didSet = true
            this.openSettings(false)
        } else {
            // TODO: don't clear until all finished
            UrlHelper.shared.clear()
        }
        
        if (!didSet && !this.splitViewController?.shouldCollapse()) {
            this.openOrganizations(false)
        }

        document.title = "Stamhoofd Administratie"
    }

    get isDevelopment() {
        return STAMHOOFD.environment == "development"
    }

    openInvoices(animated = true) {
        this.currentlySelected = "invoices"
        this.showDetail(new ComponentWithProperties(InvoicesView).setAnimated(animated))
    }

    openMembers(animated = true) {
        this.currentlySelected = "members"
        this.showDetail(new ComponentWithProperties(MembersView).setAnimated(animated))
    }

    openPendingInvoices(animated = true) {
        this.currentlySelected = "pending-invoices"
        this.showDetail(new ComponentWithProperties(PendingInvoicesView).setAnimated(animated))
    }

    openOrganizations(animated = true) {
        this.currentlySelected = "organizations"
        this.showDetail(new ComponentWithProperties(OrganizationsView).setAnimated(animated))
    }

    openEmailTemplates(animated = true) {
        this.currentlySelected = "email-templates"
        this.showDetail(new ComponentWithProperties(EditEmailTemplatesView).setAnimated(animated))
    }

    openSettings(animated = true) {
        this.currentlySelected = "settings"
        this.showDetail(new ComponentWithProperties(SettingsView).setAnimated(animated))
    }

    openAccount(animated = true) {
        this.currentlySelected = "account"
        this.showDetail(new ComponentWithProperties(AccountSettingsView).setAnimated(animated))
    }

    openStatistics(animated = true) {
        this.currentlySelected = "statistics"
        this.showDetail(new ComponentWithProperties(StatisticsView).setAnimated(animated))
    }

    async logout() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je wilt uitloggen?", "Uitloggen")) {
            return;
        }
        AdminSession.shared.logout()
    }
}
</script>