<template>
    <div id="settings-view" class="st-view">
        <STNavigationBar title="Domeinnaam kiezen" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1>
                Domeinnaam kiezen
            </h1>

            <p v-if="!isMailOk && !isRegisterOk" class="warning-box">
                Je moet jouw domeinnaam al in bezit hebben voor je deze kan instellen. Contacteer ons gerust via {{ $t('shared.emails.general') }} als je hulp nodig hebt.
            </p>
            <template v-else>
                <p v-if="isMailOk" class="success-box">
                    Jouw domeinnaam is correct ingesteld voor het versturen van e-mails. <template v-if="!organization.privateMeta.mailDomainActive">
                        Maar je moet nog even geduld hebben voor deze kan gebruikt worden.
                    </template>
                </p>
                <p v-else class="warning-box">
                    Jouw domeinnaam is nog niet actief voor het versturen van e-mails vanaf dat domeinnaam, maar je kan in tussentijd wel al e-mails versturen via Stamhoofd. Stamhoofd zorgt dat antwoorden op die e-mails wel bij jullie terecht komen.
                </p>

                <template v-if="enableMemberModule">
                    <p v-if="isRegisterOk" class="success-box">
                        Jouw domeinnaam is correct ingesteld voor jouw inschrijvingsportaal (op {{ organization.registerDomain }})
                    </p>
                    <p v-else class="warning-box">
                        Jouw domeinnaam wordt nog niet gebruikt voor jullie inschrijvingsportaal. Klik door naar 'Volgende' om die ook te configureren.
                    </p>
                </template>
            </template>
        
            <STErrorsDefault :error-box="errorBox" />

            <STInputBox title="Domeinnaam" error-fields="mailDomain" :error-box="errorBox">
                <input
                    v-model="mailDomain"
                    class="input"
                    type="text"
                    :placeholder="$t('dashboard.settings.domain.domainPlaceholder')"
                    @change="domainChanged"
                >
            </STInputBox>
            <p v-if="mailDomain && enableMemberModule" class="st-list-description">
                Jouw inschrijvingspagina zal bereikbaar zijn op {{ usedRegisterDomain }} nadat je het instellen hebt voltooid. Je kan dan ook e-mails versturen vanaf @{{ mailDomain }}.
            </p>
            <p v-else-if="mailDomain" class="st-list-description">
                Je zal e-mails kunnen versturen vanaf @{{ mailDomain }} nadat je het instellen hebt voltooid.
            </p>

            <template v-if="isStamhoofd">
                <hr>
                <h2>Geavanceerd</h2>

                <Checkbox v-model="useDkim1024bit">
                    Gebruik kortere 1024 bit DKIM sleutel (in plaats van 2048 bit)
                </Checkbox>

                <Checkbox v-model="allowSubdomain">
                    Subdomeinnaam toestaan
                </Checkbox>

                <Checkbox v-if="enableMemberModule" v-model="customRegisterDomain">
                    Andere domeinnaam voor registratie
                </Checkbox>
            </template>

            <STInputBox v-if="enableMemberModule && customRegisterDomain" title="Registratie domein" error-fields="registerDomain" :error-box="errorBox">
                <input
                    v-model="registerDomain"
                    class="input"
                    type="text"
                    :placeholder="'inschrijven.' + $t('dashboard.settings.domain.domainPlaceholder')"
                    @change="registerDomainChanged"
                >
            </STInputBox>
        </main>

        <STToolbar>
            <template slot="right">
                <button v-if="isAlreadySet" class="button secundary" type="button" @click="deleteMe">
                    <span class="icon trash" />
                    <span>Verwijderen</span>
                </button>
                <LoadingButton :loading="saving">
                    <button class="button primary" type="button" @click="save">
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
    useDkim1024bit = false
    registerDomain = OrganizationManager.organization.privateMeta?.pendingRegisterDomain ?? OrganizationManager.organization.registerDomain ?? ""
    mailDomain = OrganizationManager.organization.privateMeta?.pendingMailDomain ?? OrganizationManager.organization.privateMeta?.mailDomain ?? ""
    customRegisterDomain = this.registerDomain && this.mailDomain && (this.registerDomain !== 'inschrijven.' + this.mailDomain)
    allowSubdomain = !!this.mailDomain.match(/^[a-zA-Z0-9-]+\.[a-zA-Z0-9-]+\.[a-zA-Z]+$/)

    validateDomain() {
        const d = this.mailDomain;
        if (this.allowSubdomain) {
            if (!d.match(/^([a-zA-Z0-9-]+\.)?[a-zA-Z0-9-]+\.[a-zA-Z]+$/)) {
                return false;
            }
            return true;
        }
        if (!d.match(/^[a-zA-Z0-9-]+\.[a-zA-Z]+$/)) {
            return false
        }
        return true
    }

    validateRegisterDomain() {
        const d = this.registerDomain;
        if (!d.match(/^([a-zA-Z0-9-]+\.)?[a-zA-Z0-9-]+\.[a-zA-Z]+$/)) {
            return false;
        }
        return true;
    }

    get usedRegisterDomain() {
        return this.customRegisterDomain ? this.registerDomain : ("inschrijven."+this.mailDomain);
    }

    get isStamhoofd() {
        return OrganizationManager.user.email.endsWith("@stamhoofd.be") || OrganizationManager.user.email.endsWith("@stamhoofd.nl")
    }

    get isMailOk() {
        return this.organization.privateMeta?.pendingMailDomain === null && this.organization.privateMeta?.mailDomain !== null
    } 

    get isRegisterOk() {
        return this.organization.privateMeta?.pendingRegisterDomain === null && this.organization.registerDomain !== null
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

    registerDomainChanged() {
        const errors = new SimpleErrors()
       
        if (!this.validateRegisterDomain()) {
            errors.addError(new SimpleError({
                code: "invalid_field",
                message: "De domeinnaam die je hebt ingevuld is niet geldig",
                field: "registerDomain"
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

        if (this.customRegisterDomain && !this.validateRegisterDomain()) {
            errors.addError(new SimpleError({
                code: "invalid_field",
                message: "De domeinnaam die je hebt ingevuld is niet geldig",
                field: "registerDomain"
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
            const registerDomain = this.usedRegisterDomain;
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "POST",
                path: "/organization/domain",
                body: OrganizationDomains.create({
                    mailDomain: this.mailDomain,
                    registerDomain: (this.enableMemberModule || this.organization.registerDomain === registerDomain || this.organization.privateMeta?.pendingRegisterDomain === registerDomain) ? registerDomain : null,
                    useDkim1024bit: this.useDkim1024bit
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
