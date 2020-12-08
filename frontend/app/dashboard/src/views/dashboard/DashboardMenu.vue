<template>
    <div class="menu">
        <div class="padding-group">
            <figure id="logo" />
            <button id="organization-switcher" @click="switchOrganization">
                <span class="text">{{ organization.name }}</span>
            </button>

            <input v-if="false" class="input search" placeholder="Zoeken">
        </div>

        <a class="menu-button button heading" href="https://docs.stamhoofd.be" target="_blank">
            <span class="icon info-filled" />
            <span>Documentatie</span>
        </a>

        <a class="menu-button button heading" :href="registerUrl" target="_blank">
            <span class="icon external" />
            <span>Jouw inschrijvingspagina</span>
        </a>

        <button class="menu-button button heading" :class="{ selected: currentlySelected == 'manage-whats-new'}" @click="manageWhatsNew()">
            <span class="icon gift" />
            <span>Wat is er nieuw?</span>
            <span v-if="whatsNewBadge" class="bubble">{{ whatsNewBadge }}</span>
        </button>

        <hr v-if="groups.length > 0 && enableMemberModule">

        <div v-if="groups.length > 0 && enableMemberModule">
            <button class="menu-button button heading" :class="{ selected: currentlySelected == 'group-all'}" @click="openAll()">
                <span class="icon user" />
                <span>Leden</span>
                <button v-if="groups.length > 1" class="button">
                    Alle
                </button>
            </button>

            <button
                v-for="group in groups"
                :key="group.id"
                class="menu-button button"
                :class="{ selected: currentlySelected == 'group-'+group.id }"
                @click="openGroup(group)"
            >
                {{ group.settings.name }}
            </button>
        </div>
        
        <hr v-if="enableWebshopModule">

        <div v-if="enableWebshopModule">
            <button class="menu-button heading">
                <span class="icon basket" />
                <span>Verkopen</span>
                <button v-if="fullAccess" class="button text" @click="addWebshop()">
                    <span class="icon add" />
                    <span>Nieuw</span>
                </button>
            </button>

            <button
                v-for="webshop in webshops"
                :key="webshop.id"
                class="menu-button button"
                :class="{ selected: currentlySelected == 'webshop-'+webshop.id }"
                @click="openWebshop(webshop)"
            >
                {{ webshop.meta.name }}
            </button>
        </div>

        <hr>
        <div v-if="fullAccess">
            <button class="menu-button button heading" :class="{ selected: currentlySelected == 'manage-payments'}" @click="managePayments(true)"> 
                <span class="icon card" />
                <span>Overschrijvingen</span>
            </button>
            <button class="menu-button button heading" :class="{ selected: currentlySelected == 'manage-settings'}" @click="manageSettings(true)">
                <span class="icon settings" />
                <span>Instellingen</span>
            </button>

            <button class="menu-button button heading" :class="{ selected: currentlySelected == 'manage-admins'}" @click="manageAdmins(false)">
                <span class="icon lock" />
                <span>Beheerders</span>
            </button>

            <button v-if="isSGV" class="menu-button button heading" :class="{ selected: currentlySelected == 'manage-sgv-groepsadministratie'}" @click="openSyncScoutsEnGidsen(false)">
                <span class="icon sync" />
                <span>Groepsadministratie</span>
            </button>

            <button v-else class="menu-button button heading" :class="{ selected: currentlySelected == 'import-members'}" @click="importMembers">
                <span class="icon sync" />
                <span>Leden importeren</span>
            </button>

            <button class="menu-button button heading" :class="{ selected: currentlySelected == 'manage-account'}" @click="manageAccount(false)">
                <span class="icon user" />
                <span>Mijn account</span>
            </button>
        </div>
        <hr v-if="fullAccess">
        <div class="">
            <button class="menu-button button heading" @click="logout">
                <span class="icon logout" />
                <span>Uitloggen</span>
            </button>
        </div>
    </div>
</template>

<script lang="ts">
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ComponentWithProperties, HistoryManager } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { NavigationController } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Toast, ToastButton } from '@stamhoofd/components';
import { Sodium } from "@stamhoofd/crypto";
import { Keychain, LoginHelper,SessionManager } from '@stamhoofd/networking';
import { Group, OrganizationType, UmbrellaOrganization, WebshopPreview } from '@stamhoofd/structures';
import { Component, Mixins } from "vue-property-decorator";

import { MemberManager } from "../../classes/MemberManager";
import { OrganizationManager } from '../../classes/OrganizationManager';
import { WhatsNewCount } from '../../classes/WhatsNewCount';
import AccountSettingsView from './account/AccountSettingsView.vue';
import EditGroupsView from './groups/EditGroupsView.vue';
import GroupMembersView from "./groups/GroupMembersView.vue";
import NoKeyView from './NoKeyView.vue';
import PaymentsView from './payments/PaymentsView.vue';
import AdminsView from './admins/AdminsView.vue';
import SettingsView from './settings/SettingsView.vue';
import SGVGroepsadministratieView from './settings/SGVGroepsadministratieView.vue';
import WhatsNewView from './settings/WhatsNewView.vue';
import EditWebshopView from './webshop/EditWebshopView.vue';
import WebshopView from './webshop/WebshopView.vue';

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

        return "https://"+this.organization.uri+'.'+process.env.HOSTNAME_REGISTRATION
    }

    get isSGV() {
        return this.organization.meta.type == OrganizationType.Youth && this.organization.meta.umbrellaOrganization == UmbrellaOrganization.ScoutsEnGidsenVlaanderen
    }

    mounted() {
        const path = window.location.pathname;
        const parts = path.substring(1).split("/");
        let didSet = false

        if ((parts.length >= 1 && parts[0] == 'settings') || (parts.length == 2 && parts[0] == 'oauth' && parts[1] == 'mollie')) {
            this.manageSettings(false)
            didSet = true
        }

        if (parts.length >= 1 && parts[0] == 'transfers') {
            this.managePayments(false)
            didSet = true
        }

        if (parts.length >= 1 && parts[0] == 'admins') {
            this.manageAdmins(false)
            didSet = true
        }

        if (parts.length >= 1 && parts[0] == 'account') {
            this.manageAccount(false)
            didSet = true
        }

        if ((parts.length >= 1 && parts[0] == 'scouts-en-gidsen-vlaanderen') || (parts.length == 2 && parts[0] == 'oauth' && parts[1] == 'sgv')) {
            this.openSyncScoutsEnGidsen(false)
            didSet = true
        }

        if (!didSet) {
            HistoryManager.setUrl("/")
        }
        
        if (!didSet && !this.splitViewController?.shouldCollapse()) {
            if (this.groups.length > 0) {
                this.openGroup(this.groups[0])
            } else {
                this.manageSettings(false)
            }
        }

        document.title = "Stamhoofd - "+OrganizationManager.organization.name

        this.checkKey().catch(e => {
            console.error(e)
        })

        const currentCount = localStorage.getItem("what-is-new")
        if (currentCount) {
            const c = parseInt(currentCount)
            if (!isNaN(c) && WhatsNewCount - c > 0) {
                this.whatsNewBadge = (WhatsNewCount - c).toString()
            }
        } else {
            localStorage.setItem("what-is-new", (WhatsNewCount as any).toString());
        }

        if (this.whatsNewBadge.length > 0) {
            // show popup
            new Toast("Er zijn nieuwe functies! Volg ons op Instagram of Facebook om op de hoogte te blijven van nieuwe updates", "gift green").setHide(20*1000).setAction( () => {
                window.open("https://www.instagram.com/stamhoofd/", "_blank")
                localStorage.setItem("what-is-new", WhatsNewCount.toString());
            }).show()
        }
    }

    async checkKey() {
        // Check if public and private key matches
        const user = SessionManager.currentSession!.user!
        const privateKey = SessionManager.currentSession!.getUserPrivateKey()!
        const publicKey = user.publicKey

        if (!await Sodium.isMatchingEncryptionPublicPrivate(publicKey, privateKey)) {

            // Gather all keychain items, and check which ones are still valid
            // Oops! Error with public private key
            await LoginHelper.fixPublicKey(SessionManager.currentSession!)
            new Toast("We hebben jouw persoonlijke encryptiesleutel gecorrigeerd. Er was iets fout gegaan toen je je wachtwoord had gewijzigd.", "success green").setHide(15*1000).show()
            MemberManager.callListeners("encryption", null)
        }


        if (SessionManager.currentSession!.user!.incomingInvites.length > 0) {
            for (const invite of user.incomingInvites) {
                try {
                    const decryptedKeychainItems = await Sodium.unsealMessage(invite.keychainItems!, publicKey, privateKey)
                    await LoginHelper.addToKeychain(SessionManager.currentSession!, decryptedKeychainItems)
                    new Toast(invite.sender.firstName+" heeft een encryptiesleutel met jou gedeeld", "lock green").setHide(15*1000).show()
                } catch (e) {
                    console.error(e)
                    new Toast(invite.sender.firstName+" wou een encryptiesleutel met jou delen, maar deze uitnodiging is ongeldig geworden. Vraag om de uitnodiging opnieuw te versturen.", "error red").setHide(15*1000).show()
                }
                
                // Remove invite if succeeded
                await SessionManager.currentSession!.authenticatedServer.request({
                    method: "POST",
                    path: "/invite/"+encodeURIComponent(invite.key)+"/trade"
                })
            }

            // Reload all views
            MemberManager.callListeners("encryption", null)
        }

        try {
            const keychainItem = Keychain.getItem(OrganizationManager.organization.publicKey)
            if (!keychainItem) {
                throw new Error("Missing organization keychain")
            }

            const session = SessionManager.currentSession!
            await session.decryptKeychainItem(keychainItem)

        } catch (e) {
            console.error(e)

            // Show warnign instead
            new Toast("Je hebt geen toegang tot de huidige encryptiesleutel van deze vereniging. Vraag een administrator om jou terug toegang te geven.", "lock-missing yellow").setHide(15*1000).setButton(new ToastButton("Meer info", () => {
                this.present(new ComponentWithProperties(NoKeyView, {}).setDisplayStyle("popup"))
            })).show()
        }
    }

    get groups() {
        return this.organization.groups.filter(g => {
            return this.hasAccessToGroup(g)
        })
    }

    get webshops() {
        return this.organization.webshops
    }

    switchOrganization() {
        SessionManager.deactivateSession()
    }

    openAll() {
        if (this.groups.length <= 1) {
            return;
        }
        this.currentlySelected = "group-all"
        this.showDetail(new ComponentWithProperties(NavigationController, { root: new ComponentWithProperties(GroupMembersView, {}) }));
    }

    openGroup(group: Group) {
        this.currentlySelected = "group-"+group.id
        this.showDetail(new ComponentWithProperties(NavigationController, { root: new ComponentWithProperties(GroupMembersView, { group }) }));
    }

    openWebshop(webshop: WebshopPreview) {
        this.currentlySelected = "webshop-"+webshop.id
        this.showDetail(new ComponentWithProperties(NavigationController, { root: new ComponentWithProperties(WebshopView, { preview: webshop }) }));
    }

    managePayments(animated = true) {
        this.currentlySelected = "manage-payments"
        this.splitViewController?.showDetail(new ComponentWithProperties(NavigationController, { root: new ComponentWithProperties(PaymentsView, {}) }), animated);
    }

    manageSettings(animated = true) {
        this.currentlySelected = "manage-settings"
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.splitViewController?.showDetail(new ComponentWithProperties(NavigationController, { root: new ComponentWithProperties(SettingsView, {}) }), animated);
    }

    manageAdmins(animated = true) {
        this.currentlySelected = "manage-admins"
        this.splitViewController?.showDetail(new ComponentWithProperties(NavigationController, { root: new ComponentWithProperties(AdminsView, {}) }), animated);
    }

    manageAccount(animated = true) {
        this.currentlySelected = "manage-account"
        this.splitViewController?.showDetail(new ComponentWithProperties(NavigationController, { root: new ComponentWithProperties(AccountSettingsView, {}) }), animated);
    }

    manageWhatsNew() {
        this.currentlySelected = "manage-whats-new"
        this.showDetail(new ComponentWithProperties(WhatsNewView, {}));
        this.whatsNewBadge = ""
    }

    async logout() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je wilt uitloggen?", "Uitloggen")) {
            return;
        }
        SessionManager.logout()
    }

    openSyncScoutsEnGidsen(animated = true) {
        this.currentlySelected = "manage-sgv-groepsadministratie"
        this.splitViewController?.showDetail(new ComponentWithProperties(NavigationController, { root: new ComponentWithProperties(SGVGroepsadministratieView, {}) }), animated);
    }

    importMembers() {
        new CenteredMessage("Binnenkort beschikbaar!", "Binnenkort kan je leden importeren via Excel of manueel.", "sync").addCloseButton().show()
    }

    hasAccessToGroup(group: Group) {
        return SessionManager.currentSession!.user!.permissions!.hasReadAccess(group.id)
    }

    addWebshop() {
        this.present(new ComponentWithProperties(EditWebshopView, { }).setDisplayStyle("popup"))
    }

    get fullAccess() {
        return SessionManager.currentSession!.user!.permissions!.hasFullAccess()
    }

    get fullReadAccess() {
        return SessionManager.currentSession!.user!.permissions!.hasReadAccess()
    }

    get enableMemberModule() {
        return this.organization.meta.modules.useMembers
    }

    get enableWebshopModule() {
        return this.organization.meta.modules.useWebshops
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
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    max-width: 100%;
    box-sizing: border-box;
   
    > .text {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        max-width: auto;
        min-width: none;
    }

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
    transition: transform 0.2s, background-color 0.2s, color 0.2s;

    text-overflow: ellipsis;
    vertical-align: middle;
    overflow: hidden;
    white-space: nowrap;

    

    &, &:active, &:visited, &:link {
        text-decoration: none;
    }

    > .icon {
        padding-right: 10px;
        flex-shrink: 0;
    }

    > span {
         text-overflow: ellipsis;
        vertical-align: middle;
        overflow: hidden;
        white-space: nowrap;
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

    &.button {
        cursor: pointer;

        &:active {
            background-color: $color-gray-lighter;
        }
    }

    > button {
        margin-left: auto;
        color: $color-primary;

       
    }
}
</style>
