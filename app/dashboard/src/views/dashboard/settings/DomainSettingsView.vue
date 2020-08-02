<template>
    <div class="st-view" id="settings-view">
        <STNavigationBar title="Instellingen">
            <BackButton slot="left" v-if="canPop" @click="pop"/>
            <button slot="right" class="button icon close gray" v-if="canDismiss" @click="dismiss"/>
        </STNavigationBar>

        <main>
            <h1>
                Domeinnaam kiezen
            </h1>
        
            <STErrorsDefault :error-box="errorBox" />

            <STInputBox title="Domeinnaam" error-fields="mailDomain" :error-box="errorBox" >
                <input
                    v-model="mailDomain"
                    class="input"
                    type="text"
                    placeholder="bv. jouwvereniging.be"
                    @change="domainChanged"
                >
            </STInputBox>
        </main>

        <STToolbar>
            <template slot="right">
                <button v-if="isAlreadySet" class="button secundary" @click="deleteMe">
                    <span class="icon trash"/>
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
import { AutoEncoder, AutoEncoderPatchType, Decoder,PartialWithoutMethods, PatchType, ArrayDecoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, BackButton, Checkbox,STErrorsDefault,STInputBox, STNavigationBar, STToolbar, LoadingButton, Validator } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Group, GroupGenderType, GroupPatch, GroupSettings, GroupSettingsPatch, Organization, OrganizationPatch, Address, OrganizationDomains, DNSRecord } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";
import { OrganizationManager } from "../../../classes/OrganizationManager"
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
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
        if (!d.match(/^[a-zA-Z0-9]+\.[a-zA-Z]+$/)) {
            return false
        } else {
        }
        return true
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
            OrganizationManager.organization = response.data
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
