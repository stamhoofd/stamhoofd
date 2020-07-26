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
            <h2>Inschrijvingspagina</h2>
            <p class="st-list-description">Jouw inschrijvingspagina is bereikbaar via {{ organization.uri }}.stamhoofd.be. Je kan ook je eigen domeinnaam (bv. inschrijven.mijnvereniging.be) instellen. Hiervoor moet je wel het domeinnaam al gekocht hebben, meestal zal dat al het geval zijn als je al een eigen website hebt.</p>


            <Checkbox v-model="useRegisterDomain">Ik wil mijn eigen domeinnaam gebruiken</Checkbox>

            <template v-if="useRegisterDomain">
                <STInputBox title="Subdomeinnaam" error-fields="registerDomain" :error-box="errorBox" >
                    <input
                        v-model="registerDomain"
                        class="input"
                        type="text"
                        placeholder="bv. inschrijven.vereniging.be"
                        @change="validateRegisterDomain"
                    >
                </STInputBox>

                
                <template v-if="registerDomain.length > 3 && showDomainSettings">
                    <h3 class="style-label">Instellen</h3>

                    <p class="st-list-description">Stel de volgende CNAME record in bij de DNS-instellingen van jouw domeinnaam. Dit kan je meestal doen in het klantenpaneel van de registrar (Combell, Versio, Transip, One.com, GoDaddy...) waar je je domeinnaam hebt gekocht.</p>
                    
                    <dl class="details-grid dns-settings">
                        <dt>Type</dt>
                        <dd>CNAME</dd>

                        <dt>Naam</dt>
                        <dd>{{ registerDomain }}.</dd>

                        <dt>Waarde</dt>
                        <dd>{{ organization.uri }}.stamhoofd.be.</dd>

                        <dt>TTL</dt>
                        <dd>3306 / 1 uur</dd>
                    </dl>

                    <a class="button text" :href="'https://www.samdns.com/lookup/cname/'+registerDomain+'/'" target="_blank">Testen</a>

                    <p class="warning-box">Zorg dat je weet wat je doet en de instructies exact opvolgt. Als je niet alles correct volgt kan jouw huidige website onbereikbaar worden.</p>
                    <p class="warning-box">Het kan tot 24 uur duren tot de aanpassingen zijn doorgevoerd, in de meeste gevallen zou het binnen 1 uur al in orde moeten zijn.</p>
                </template>
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
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BirthYearInput, DateSelection, ErrorBox, BackButton, RadioGroup, Checkbox, Spinner,STErrorsDefault,STInputBox, STNavigationBar, STToolbar, AddressInput, Validator } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Group, GroupGenderType, GroupPatch, GroupSettings, GroupSettingsPatch, Organization, OrganizationPatch, Address } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";
import { OrganizationManager } from "../../../classes/OrganizationManager"
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';

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

    get useRegisterDomain() {
        return this.organization.registerDomain !== null
    }

    set useRegisterDomain(use: boolean) {
        if (use) {
            this.$set(this.organizationPatch, "registerDomain", this.organization.registerDomain ?? "")
        } else {
            this.$set(this.organizationPatch, "registerDomain", null)
        }
    }

    get registerDomain() {
        return this.organization.registerDomain ?? ""
    }

    set registerDomain(registerDomain: string) {
        this.$set(this.organizationPatch, "registerDomain", registerDomain)
        console.log(registerDomain)
        this.showDomainSettings = false
    }

    validateRegisterDomain() {
        const d = this.registerDomain;
        if (d.length == 0) {
            this.useRegisterDomain = false
            return true
        }
        if (!d.match(/^[a-zA-Z0-9]+\.[a-zA-Z0-9]+\.[a-zA-Z]+$/)) {
            this.showDomainSettings = false

            return false
        } else {
            this.showDomainSettings = true
        }
        return true
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

        if (!this.validateRegisterDomain()) {
            errors.addError(new SimpleError({
                code: "invalid_field",
                message: "De subdomeinnaam die je hebt ingevuld is niet geldig",
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

        await OrganizationManager.patch(this.organizationPatch)
        this.saving = false
        //this.pop({ force: true })
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
