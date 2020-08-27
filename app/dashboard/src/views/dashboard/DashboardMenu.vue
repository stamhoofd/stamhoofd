<template>
    <div class="menu">
        <div class="padding-group">
            <figure id="logo" />
            <button id="organization-switcher" @click="switchOrganization">
                {{ organization.name }}
            </button>

            <input class="input search" placeholder="Zoeken" v-if="false">
        </div>

        <a class="menu-button button heading" href="https://docs.stamhoofd.be" target="_blank">
            <span class="icon info-filled"/>
            <span>Documentatie</span>
        </a>

        <a class="menu-button button heading" :href="registerUrl" target="_blank">
            <span class="icon external"/>
            <span>Jouw inschrijvingspagina</span>
        </a>

        <button class="menu-button button heading" :class="{ selected: currentlySelected == 'manage-whats-new'}" @click="manageWhatsNew()">
            <span class="icon gift"/>
            <span>Wat is er nieuw?</span>
            <span class="bubble" v-if="whatsNewBadge">{{ whatsNewBadge }}</span>
        </button>

        <hr v-if="groups.length > 0">

        <div v-if="groups.length > 0">
            <button class="menu-button button heading" :class="{ selected: currentlySelected == 'group-all'}" @click="openAll()">
                <span class="icon user"/>
                <span>Leden</span>
                <button class="button" v-if="fullReadAccess && false">
                    Alle
                </button>
            </button>

            <button
                v-for="group in groups"
                :key="group.id"
                class="menu-button"
                :class="{ selected: currentlySelected == 'group-'+group.id }"
                @click="openGroup(group)"
            >
                {{ group.settings.name }}
            </button>
        </div>
        <hr v-if="groups.length > 0">
        <div v-if="fullAccess">
            <button class="menu-button button heading" @click="manageGroups" :class="{ selected: currentlySelected == 'manage-groups'}">
                <span class="icon group"/>
                <span>Leeftijdsgroepen</span>
            </button>
            <button class="menu-button button heading" @click="managePayments" :class="{ selected: currentlySelected == 'manage-payments'}"> 
                <span class="icon card"/>
                <span>Overschrijvingen</span>
            </button>
            <button class="menu-button button heading" @click="manageSettings(true)" :class="{ selected: currentlySelected == 'manage-settings'}">
                <span class="icon settings"/>
                <span>Instellingen</span>
            </button>

            <button class="menu-button button heading" @click="manageAdmins" :class="{ selected: currentlySelected == 'manage-admins'}">
                <span class="icon lock"/>
                <span>Beheerders</span>
            </button>

            <button class="menu-button button heading" @click="importMembers" :class="{ selected: currentlySelected == 'import-members'}">
                <span class="icon sync"/>
                <span>Leden importeren</span>
            </button>

            <button class="menu-button button heading" @click="manageAccount" :class="{ selected: currentlySelected == 'manage-account'}">
                <span class="icon user"/>
                <span>Mijn account</span>
            </button>
        </div>
        <hr v-if="fullAccess">
        <div class="">
            <button class="menu-button button heading" @click="logout">
                <span class="icon logout"/>
                <span>Uitloggen</span>
            </button>
        </div>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, HistoryManager } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { NavigationController } from "@simonbackx/vue-app-navigation";
import { SessionManager, Keychain } from '@stamhoofd/networking';
import { Organization, Group } from '@stamhoofd/structures';
import { Component, Mixins } from "vue-property-decorator";

import EditGroupsView from './groups/EditGroupsView.vue';
import GroupMembersView from "./groups/GroupMembersView.vue";
import PaymentsView from './payments/PaymentsView.vue';
import SettingsView from './settings/SettingsView.vue';
import AdminsView from './settings/AdminsView.vue';
import { OrganizationManager } from '../../classes/OrganizationManager';
import { CenteredMessage, Toast } from '@stamhoofd/components';
import AccountSettingsView from './account/AccountSettingsView.vue';
import NoKeyView from './NoKeyView.vue';
import { Decoder } from '@simonbackx/simple-encoding';
import WhatsNewView from './settings/WhatsNewView.vue';
import { WhatsNewCount } from '../../classes/WhatsNewCount';



@Component({})
export default class Menu extends Mixins(NavigationMixin) {
    SessionManager = SessionManager // needed to make session reactive
    currentlySelected: string | null = null
    whatsNewBadge = ""

    get organization() {
        return OrganizationManager.organization
    }
    
    get registerUrl() {
        if (this.organization.privateMeta && this.organization.privateMeta.mailDomain && this.organization.registerDomain) {
            return "https://"+this.organization.registerDomain
        } 

        if (process.env.NODE_ENV == "production") {
            return "https://"+this.organization.uri+'.stamhoofd.be'
        }
        return "https://"+this.organization.uri+'.stamhoofd.dev'
    }

    mounted() {
        const path = window.location.pathname;
        const parts = path.substring(1).split("/");
        let didSet = false

        if ((parts.length >= 1 && parts[0] == 'settings') || (parts.length == 2 && parts[0] == 'oauth' && parts[1] == 'mollie')) {
            this.manageSettings(false)
            didSet = true
        }

        if (!didSet) {
            HistoryManager.setUrl("/")
        }
        if (!didSet && !this.splitViewController?.shouldCollapse()) {
            if (this.groups.length > 0) {
                this.openGroup(this.groups[0])
            } else {
                this.manageGroups()
            }
        }

        document.title = "Stamhoofd - "+OrganizationManager.organization.name

        this.checkKey()

        const currentCount = localStorage.getItem("what-is-new")
        if (currentCount) {
            const c = parseInt(currentCount)
            if (!isNaN(c) && WhatsNewCount - c > 0) {
                this.whatsNewBadge = (WhatsNewCount - c).toString()
            }
        } else {
            if (WhatsNewCount == 1) {
                // Only once for existing users
                localStorage.setItem("what-is-new", (WhatsNewCount - 1 ).toString());
                this.whatsNewBadge = "1"
            } else {
                localStorage.setItem("what-is-new", (WhatsNewCount as any).toString());
            }
        }
    }

    async checkKey() {
        try {
            const keychainItem = Keychain.getItem(OrganizationManager.organization.publicKey)
            if (!keychainItem) {
                throw new Error("Missing organization keychain")
            }

            const session = SessionManager.currentSession!
            const keyPair = await session.decryptKeychainItem(keychainItem)

        } catch (e) {
            this.present(new ComponentWithProperties(NoKeyView, {}).setDisplayStyle("popup"))
        }
    }

    get groups() {
        return this.organization.groups!.filter(g => {
            return this.hasAccessToGroup(g)
        })
    }

    switchOrganization() {
        SessionManager.deactivateSession()
    }

    openAll() {
        if (!this.fullReadAccess) {
            return;
        }
        return;
        this.currentlySelected = "group-all"
        //this.showDetail(new ComponentWithProperties(GroupMembersView, { organization: this.mockOrganization }));
    }

    openGroup(group: Group) {
        this.currentlySelected = "group-"+group.id
        this.showDetail(new ComponentWithProperties(NavigationController, { root: new ComponentWithProperties(GroupMembersView, { group }) }));
    }

    manageGroups() {
        this.currentlySelected = "manage-groups"
        this.showDetail(new ComponentWithProperties(EditGroupsView, {}));
    }

    managePayments() {
        this.currentlySelected = "manage-payments"
        this.showDetail(new ComponentWithProperties(PaymentsView, {}));
    }

    manageSettings(animated: boolean = true) {
        this.currentlySelected = "manage-settings"
        this.splitViewController!.showDetail(new ComponentWithProperties(SettingsView, {}), animated);
    }

    manageAdmins() {
        this.currentlySelected = "manage-admins"
        this.showDetail(new ComponentWithProperties(AdminsView, {}));
    }

    manageAccount() {
        this.currentlySelected = "manage-account"
        this.showDetail(new ComponentWithProperties(AccountSettingsView, {}));
    }

    manageWhatsNew() {
        this.currentlySelected = "manage-whats-new"
        this.showDetail(new ComponentWithProperties(WhatsNewView, {}));
        this.whatsNewBadge = ""
    }

    logout() {
        if (!confirm("Ben je zeker dat je wilt uitloggen?")) {
            return;
        }
        SessionManager.currentSession!.logout()
    }

    importMembers() {
        this.present(new ComponentWithProperties(CenteredMessage, { title: "Binnenkort beschikbaar!", description: "Binnenkort kan je leden importeren via Excel of manueel.", closeButton: "Sluiten", type: "sync" }).setDisplayStyle("overlay"))
    }

    hasAccessToGroup(group: Group) {
        return SessionManager.currentSession!.user!.permissions!.hasReadAccess(group.id)
    }

    get fullAccess() {
        return SessionManager.currentSession!.user!.permissions!.hasFullAccess()
    }

    get fullReadAccess() {
        return SessionManager.currentSession!.user!.permissions!.hasReadAccess()
    }
}
</script>

<style scoped lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

#organization-switcher {
    margin-bottom: 15px;
    padding-left: 40px;
    display: flex;
    align-items: center;
    touch-action: manipulation;
    user-select: none;
    cursor: pointer;
    @extend .style-interactive-small;
    -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
    transition: opacity 0.2s;

    &:active {  
        opacity: 0.4;
        transition: none;
    }

    &::after {
        content: "";
        display: block;
        width: 10px;
        height: 10px;
        margin-left: 5px;;
        background: url("~@stamhoofd/assets/images/icons/gray/arrow-down-small.svg") center center no-repeat;
    }
}

.menu {
    padding: 30px 0;

    --horizontal-padding: 30px;
}

.input.search {
    margin-bottom: 20px;
}

#logo {
    display: block;
    margin-bottom: 5px;
}

.menu > .padding-group {
    padding-left: var(--horizontal-padding, 30px);
    padding-right: var(--horizontal-padding, 30px);
}

.menu > hr {
    height: $border-width;
    border-radius: $border-width/2;
    background: $color-gray-light;
    border: 0;
    outline: 0;
    margin: 20px var(--horizontal-padding, 30px);
}

.menu-button {
    display: flex;
    flex-direction: row;
    @extend .style-button-smaller;
    color: $color-dark;
    align-items: center;
    justify-content: flex-start;
    width: 100%;
    box-sizing: border-box;
    height: 45px;
    cursor: pointer;
    transition: transform 0.2s, background-color 0.2s, color 0.2s;

    text-overflow: ellipsis;
    vertical-align: middle;
    overflow: hidden;
    white-space: nowrap;

    &, &:active, &:visited, &:link {
        text-decoration: none;
    }

    .icon {
        padding-right: 10px;
    }

    .bubble {
        margin-left: auto;
        flex-shrink: 0;
        width: 20px;
        height: 20px;
        display: block;
        background: $color-primary;
        border-radius: 10px;
        font-size: 12px;
        font-weight: bold;
        text-align: center;
        line-height: 20px;
        vertical-align: middle;
        color: $color-white;
    }

    &:active {
        background-color: $color-gray-lighter;
    }

    padding-left: var(--horizontal-padding, 30px);
    padding-right: var(--horizontal-padding, 30px);

    &.heading {
        @extend .style-button-small;
        color: $color-gray-dark;
    }

    &.selected {
        background-color: $color-primary-light;
        color: $color-primary;
        font-weight: 600;
    }

    > button {
        margin-left: auto;
        color: $color-primary;
    }
}
</style>
