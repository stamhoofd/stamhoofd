<template>
    <div id="settings-view" class="st-view">
        <STNavigationBar title="Instellingen">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-if="canDismiss" slot="right" class="button icon close gray" @click="dismiss" />
        </STNavigationBar>

        <main>
            <h1>
                Domeinnaam kiezen
            </h1>

            <p class="success-box" v-if="isOk">Jouw domeinnaam is correct ingesteld</p>
            <p class="warning-box" v-else>Je moet jouw domeinnaam al in bezit hebben voor je deze kan instellen. Contacteer ons gerust via hallo@stamhoofd.be als je hulp nodig hebt.</p>
        
            <STErrorsDefault :error-box="errorBox" />

            <STInputBox title="Domeinnaam" error-fields="mailDomain" :error-box="errorBox">
                <input
                    v-model="mailDomain"
                    class="input"
                    type="text"
                    placeholder="bv. jouwvereniging.be"
                    @change="domainChanged"
                >
            </STInputBox>
            <p class="st-list-description" v-if="mailDomain && enableMemberModule">
                Jouw inschrijvingspagina zal bereikbaar zijn op inschrijven.{{ mailDomain }} nadat je het instellen hebt voltooid. Je kan dan ook e-mails versturen vanaf @{{ mailDomain }}.
            </p>
            <p class="st-list-description" v-else-if="mailDomain">
               Je zal e-mails kunnen versturen vanaf @{{ mailDomain }} nadat je het instellen hebt voltooid.
            </p>
            
        </main>

        <STToolbar>
            <template slot="right">
                <button v-if="isAlreadySet" class="button secundary" @click="deleteMe">
                    <span class="icon trash" />
                    <span>Verwijderen</span>
                </button>
                <LoadingButton :loading="saving">
                    <button class="button primary" @click="save">
                        Volgende
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox,ErrorBox, LoadingButton, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Organization, OrganizationDomains } from "@stamhoofd/structures"
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager"
import DNSRecordsView from './DNSRecordsView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        Checkbox,
        BackButton,
        LoadingButton
    },
})
export default class DomainSettingsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false

    mailDomain = OrganizationManager.organization.privateMeta?.pendingMailDomain ?? OrganizationManager.organization.privateMeta?.mailDomain ?? ""
    
    validateDomain() {
        const d = this.mailDomain;
        if (!d.match(/^[a-zA-Z0-9-]+\.[a-zA-Z]+$/)) {
            return false
        }
        return true
    }

    get isOk() {
        return this.organization.privateMeta?.pendingMailDomain === null && this.organization.privateMeta?.pendingRegisterDomain === null && this.organization.privateMeta?.mailDomain !== null
    } 

    get organization() {
        return OrganizationManager.organization
    }

    get enableMemberModule() {
        return this.organization.meta.modules.useMembers
    }

    get isAlreadySet() {
        return !!(OrganizationManager.organization.privateMeta?.pendingMailDomain ?? OrganizationManager.organization.privateMeta?.mailDomain)
    }

    domainChanged() {
        const errors = new SimpleErrors()
       
        if (!this.validateDomain()) {
            errors.addError(new SimpleError({
                code: "invalid_field",
                message: "De domeinnaam die je hebt ingevuld is niet geldig",
                field: "mailDomain"
            }))
            this.errorBox = new ErrorBox(errors)
        } else {
            this.errorBox = null
        }
    }
  
    async save() {
        if (this.saving) {
            return;
        }

        const errors = new SimpleErrors()
       
        if (!this.validateDomain()) {
            errors.addError(new SimpleError({
                code: "invalid_field",
                message: "De domeinnaam die je hebt ingevuld is niet geldig",
                field: "mailDomain"
            }))
        }

        let valid = false

        if (errors.errors.length > 0) {
            this.errorBox = new ErrorBox(errors)
        } else {
            this.errorBox = null
            valid = true
        }
        valid = valid && await this.validator.validate()

        if (!valid) {
            return;
        }

        this.saving = true

        try {
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "POST",
                path: "/organization/domain",
                body: OrganizationDomains.create({
                    mailDomain: this.mailDomain,
                    registerDomain: "inschrijven."+this.mailDomain
                }),
                decoder: Organization as Decoder<Organization>
            })
            OrganizationManager.organization.set(response.data)
            this.show(new ComponentWithProperties(DNSRecordsView, {}))
            this.saving = false
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
            this.saving = false
        }

            //this.pop({ force: true })
    }

    async deleteMe() {
        if (this.saving) {
            return;
        }

        if (!confirm("Ben je zeker dat je jouw domeinnaam wilt loskoppelen?")) {
            return;
        }

        this.saving = true

        try {
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "POST",
                path: "/organization/domain",
                body: OrganizationDomains.create({
                    mailDomain: null,
                    registerDomain: null
                }),
                decoder: Organization as Decoder<Organization>
            })
            OrganizationManager.organization = response.data
            this.pop({ force: true })
            this.saving = false
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
            this.saving = false
        }
    }


}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;


#settings-view {
    .dns-settings {
        padding: 20px 0;
        max-width: 500px;;

        dd {
            font-family: monospace;
            white-space: nowrap;
        }
    }
}
</style>
