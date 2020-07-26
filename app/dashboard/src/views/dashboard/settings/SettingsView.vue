<template>
    <div class="st-view" id="settings-view">
        <STNavigationBar title="Instellingen">
            <BackButton slot="left" v-if="canPop" @click="pop"/>
        </STNavigationBar>

        <main>
            <h1>
                Instellingen
            </h1>
        
            <STErrorsDefault :error-box="errorBox" />

            <hr>
            <h2>Algemeen</h2>

            <div class="split-inputs">
                <div>
                    <STInputBox title="Naam van je vereniging" error-fields="name" :error-box="errorBox">
                        <input
                            id="organization-name"
                            ref="firstInput"
                            v-model="name"
                            class="input"
                            type="text"
                            placeholder="De naam van je vereniging"
                            autocomplete="organization"
                        >
                    </STInputBox>

                    <AddressInput title="Adres van je vereniging" v-model="address" :validator="validator"/>
                </div>

                <div>
                    <STInputBox title="Website (optioneel)" error-fields="website" :error-box="errorBox">
                        <input
                            v-model="website"
                            class="input"
                            type="url"
                            placeholder="bv. https://www.vereniging.be"
                        >
                    </STInputBox>
                    <p class="st-list-description">De link naar de website van jouw vereniging. Dit is de website waar leden terecht komen als ze op 'terug naar website' klikken.</p>

                </div>
            </div>

            <hr>
            <h2>Domeinnaam</h2>

            <template v-if="organization.privateMeta && organization.privateMeta.pendingMailDomain">
                <p class="warning-box">Jouw nieuwe domeinnaam ({{ organization.privateMeta.pendingMailDomain }}) is nog niet geactiveerd. Voeg de DNS-records toe en verifieer je wijzigingen om deze te activeren.</p>
                <button class="button secundary" @click="openRecords">DNS-records instellen en verifiëren</button>
            </template>

            <template v-else-if="organization.privateMeta && organization.privateMeta.mailDomain">
                <p class="st-list-description">Jouw inschrijvingspagina is bereikbaar via <a class="button link" :href="'https://'+(organization.registerDomain || organization.uri+'.stamhoofd.be')" target="_blank">{{ organization.registerDomain || organization.uri+'.stamhoofd.be' }}</a> én jouw e-mails worden verstuurd vanaf <strong>@{{ organization.privateMeta.mailDomain }}</strong>.</p>
                
                <p class="warning-box" v-if="!organization.privateMeta.mailDomainActive">Jouw e-mail domeinnaam is nog niet actief, deze wordt binnenkort geactiveerd.</p>

                <p><button class="button secundary" @click="setupDomain">Domeinnaam wijzigen</button></p>

            </template>

            <template v-else>
                <p class="st-list-description">Jouw inschrijvingspagina is bereikbaar via <a class="button link" :href="'https://'+organization.uri+'.stamhoofd.be'" target="_blank">{{ organization.uri }}.stamhoofd.be</a>. Je kan ook je eigen domeinnaam (bv. inschrijven.mijnvereniging.be) instellen. Hiervoor moet je wel het domeinnaam al gekocht hebben, meestal zal dat al het geval zijn als je al een eigen website hebt.</p>
                <button class="button secundary" @click="setupDomain">Domeinnaam instellen</button>
            </template>

      

        </main>

        <STToolbar>
            <template slot="right">
                <Spinner v-if="saving" />
                <button class="button primary" @click="save">
                    Opslaan
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, Decoder,PartialWithoutMethods, PatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin, NavigationController } from "@simonbackx/vue-app-navigation";
import { BirthYearInput, DateSelection, ErrorBox, BackButton, RadioGroup, Checkbox, Spinner,STErrorsDefault,STInputBox, STNavigationBar, STToolbar, AddressInput, Validator } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Group, GroupGenderType, GroupPatch, GroupSettings, GroupSettingsPatch, Organization, OrganizationPatch, Address } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";
import { OrganizationManager } from "../../../classes/OrganizationManager"
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import DomainSettingsView from './DomainSettingsView.vue';
import DNSRecordsView from './DNSRecordsView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        Checkbox,
        DateSelection,
        RadioGroup,
        BackButton,
        AddressInput,
        Spinner
    },
})
export default class SettingsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false
    temp_organization = OrganizationManager.organization
    showDomainSettings = true

    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({ id: OrganizationManager.organization.id })

    get organization() {
        return OrganizationManager.organization.patch(this.organizationPatch)
    }
   
    get name() {
        return this.organization.name
    }

    set name(name: string) {
        this.$set(this.organizationPatch, "name", name)
    }

    get website() {
        return this.organization.website ?? ""
    }

    set website(website: string) {
        this.$set(this.organizationPatch, "website", website.length == 0 ? null : website)
    }

    get address() {
        return this.organization.address
    }

    set address(address: Address) {
        this.organizationPatch.address = address
    }

    async save() {
        if (this.saving) {
            return;
        }

        const errors = new SimpleErrors()
        if (this.name.length < 2) {
            errors.addError(new SimpleError({
                code: "invalid_field",
                message: "Vul een geldige naam in voor je vereniging",
                field: "name"
            }))
        }

        if (this.organization.website && this.organization.website.length > 0 && !this.organization.website.startsWith("http://") && !this.organization.website.startsWith("https://")) {
            this.website = "http://"+this.organization.website
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

        await OrganizationManager.patch(this.organizationPatch)
        this.saving = false
        //this.pop({ force: true })
    }

    setupDomain() {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(DomainSettingsView, {})
        }).setDisplayStyle("popup"))
    }

    openRecords() {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(DNSRecordsView, {})
        }).setDisplayStyle("popup"))
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;


#settings-view {
    > main {
        > h2{
            @extend .style-title-2;
            padding-bottom: 15px;
        }

        > hr{
            @extend .style-hr;
        }
    }

    .dns-settings {
        padding: 20px 0;
        max-width: 500px;;

        dd {
            font-family: monospace;
            white-space: nowrap;
            word-wrap: none;
        }
    }
}
</style>
