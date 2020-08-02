<template>
    <div class="st-view background" id="settings-view">
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
                        />
                    </STInputBox>
                    <p class="st-list-description">De link naar de website van jouw vereniging. Dit is de website waar leden terecht komen als ze op 'terug naar website' klikken.</p>

                    <IBANInput title="Bankrekeningnummer" v-model="iban" :validator="validator"/>

                </div>
            </div>

            <hr>
            <h2>Domeinnaam</h2>

            <template v-if="organization.privateMeta && organization.privateMeta.pendingMailDomain">
                <p class="warning-box">Jouw nieuwe domeinnaam ({{ organization.privateMeta.pendingMailDomain }}) is nog niet geactiveerd. Voeg de DNS-records toe en verifieer je wijzigingen om deze te activeren.</p>
                <p class="st-list-description">
                    <button class="button secundary" @click="openRecords">DNS-records instellen en verifiëren</button>
                    <button class="button text" @click="setupDomain">
                        <span class="icon settings" />
                        <span>Wijzigen</span>
                    </button>
                </p>
            </template>

            <template v-else-if="organization.privateMeta && organization.privateMeta.mailDomain">
                <p class="st-list-description">Jouw inschrijvingspagina is bereikbaar via <a class="button link" :href="'https://'+(organization.registerDomain || organization.uri+'.stamhoofd.be')" target="_blank">{{ organization.registerDomain || organization.uri+'.stamhoofd.be' }}</a> en jouw e-mails kunnen worden verstuurd vanaf <strong>iets@{{ organization.privateMeta.mailDomain }}</strong>.</p>
                
                <p class="warning-box" v-if="!organization.privateMeta.mailDomainActive">Jouw e-mail domeinnaam is nog niet actief, deze wordt binnenkort geactiveerd.</p>

                <p class="st-list-description">
                    <button class="button text" @click="setupDomain">
                        <span class="icon settings" />
                        <span>Domeinnaam wijzigen</span>
                    </button>
                </p>

            </template>

            <template v-else>
                <p class="st-list-description">Jouw inschrijvingspagina is bereikbaar via <a class="button link" :href="'https://'+organization.uri+'.stamhoofd.be'" target="_blank">{{ organization.uri }}.stamhoofd.be</a>. Je kan ook je eigen domeinnaam (bv. inschrijven.mijnvereniging.be) instellen. Hiervoor moet je wel het domeinnaam al gekocht hebben, meestal zal dat al het geval zijn als je al een eigen website hebt.</p>

                <p class="st-list-description">
                    <button class="button text" @click="setupDomain">
                        <span class="icon settings" />
                        <span>Domeinnaam instellen</span>
                    </button>
                </p>
            </template>

            <hr>
            <h2>E-mailadressen</h2>
            
            <p class="st-list-description" v-if="organization.privateMeta && organization.privateMeta.mailDomainActive">
                Voeg hier de e-mailadressen van jouw vereniging toe. Als je e-mailadressen hebt die eindigen op @{{ organization.privateMeta.mailDomain }}, kan je e-mails versturen vanaf dat e-mailadres. Bij andere e-mailadressen (bv. {{ organization.uri }}@gmail.com) kunnen we enkel instellen dat leden antwoorden naar dat e-mailadres, de e-mail wordt nog steeds verstuurd vanaf iets@{{ organization.privateMeta.mailDomain }}. Voeg enkel e-mailadressen toe waar je ook e-mails kan op ontvangen.
            </p>
            <p class="st-list-description" v-else>
                Voeg hier de e-mailadressen van jouw vereniging toe. Als je e-mailadressen hebt met jouw eigen domeinnaam (bv. info@mijnvereniging.be), kan je e-mails versturen vanaf dat e-mailadres als je het domeinnaam hierboven eerst toevoegt. Bij andere e-mailadressen (bv. {{ organization.uri }}@gmail.com) kunnen we enkel instellen dat leden antwoorden naar dat e-mailadres, de e-mail wordt nog steeds verstuurd vanaf iets@{{ organization.uri }}.stamhoofd.be. Voeg enkel e-mailadressen toe waarop je e-mails kan ontvangen.
            </p>

            <p class="st-list-description">
                <button class="button text" @click="setupEmail">
                    <span class="icon settings" />
                    <span>E-mailadressen instellen</span>
                </button>
            </p>

        </main>

        <STToolbar>
            <template slot="right">
                <LoadingButton :loading="saving">
                    <button class="button primary" @click="save">
                        Opslaan
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, Decoder,PartialWithoutMethods, PatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin, NavigationController } from "@simonbackx/vue-app-navigation";
import { BirthYearInput, DateSelection, ErrorBox, BackButton, RadioGroup, Checkbox, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, AddressInput, Validator, LoadingButton, IBANInput } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Group, GroupGenderType, GroupPatch, GroupSettings, GroupSettingsPatch, Organization, OrganizationPatch, Address, OrganizationMetaData } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";
import { OrganizationManager } from "../../../classes/OrganizationManager"
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import DomainSettingsView from './DomainSettingsView.vue';
import DNSRecordsView from './DNSRecordsView.vue';
import EmailSettingsView from './EmailSettingsView.vue';

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
        LoadingButton,
        IBANInput
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

    get iban() {
        return this.organization.meta.iban
    }

    set iban(iban: string) {
        if (!this.organizationPatch.meta) {
            this.$set(this.organizationPatch, "meta", OrganizationMetaData.patchType().create({}))
        }
        this.$set(this.organizationPatch.meta, "iban", iban)
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

    setupEmail() {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(EmailSettingsView, {})
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
