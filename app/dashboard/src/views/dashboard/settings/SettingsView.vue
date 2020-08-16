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
            <h2>Huisstijl</h2>
            <p>Als je een logo hebt kan je deze hier toevoegen. Je kan kiezen om een vierkant logo, een horizontaal logo of beide te uploaden. We kiezen dan automatisch het beste logo afhankelijk van de schermgrootte.</p>

            <div class="split-inputs">
                <div>
                    <ImageInput title="Horizontaal logo" :validator="validator" v-model="horizontalLogo" :resolutions="horizontalLogoResolutions" :required="false"/>

                    <p class="st-list-description">Beter voor grotere schermen.</p>
                </div>

                <div>
                    <ImageInput title="Vierkant logo" :validator="validator" v-model="squareLogo" :resolutions="squareLogoResolutions" :required="false"/>
                    <p class="st-list-description">Beter voor op kleine schermen. Laat tekst zoveel mogelijk weg uit dit logo.</p>
                </div>
            </div>

            <ColorInput title="Hoofdkleur (optioneel)" v-model="color" :validator="validator" placeholder="Geen kleur" :required="false"/>
            <p class="st-list-description">Vul hierboven de HEX-kleurcode van jouw hoofdkleur in. Laat leeg om het blauwe kleur te behouden.</p>

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
                <p class="st-list-description">Jouw inschrijvingspagina is bereikbaar via <a class="button inline-link" :href="'https://'+(organization.registerDomain || organization.uri+'.stamhoofd.be')" target="_blank">{{ organization.registerDomain || organization.uri+'.stamhoofd.be' }}</a> en jouw e-mails kunnen worden verstuurd vanaf <strong>iets@{{ organization.privateMeta.mailDomain }}</strong>.</p>
                
                <p class="warning-box" v-if="!organization.privateMeta.mailDomainActive">Jouw e-mail domeinnaam is nog niet actief, deze wordt binnenkort geactiveerd.</p>

                <p class="st-list-description">
                    <button class="button text" @click="setupDomain">
                        <span class="icon settings" />
                        <span>Domeinnaam wijzigen</span>
                    </button>
                </p>

            </template>

            <template v-else>
                <p class="st-list-description">Jouw inschrijvingspagina is bereikbaar via <a class="button inline-link" :href="'https://'+organization.uri+'.stamhoofd.be'" target="_blank">{{ organization.uri }}.stamhoofd.be</a>. Je kan ook je eigen domeinnaam (bv. inschrijven.mijnvereniging.be) instellen. Hiervoor moet je wel het domeinnaam al gekocht hebben, meestal zal dat al het geval zijn als je al een eigen website hebt.</p>

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
import { AutoEncoder, AutoEncoderPatchType, Decoder,PartialWithoutMethods, PatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin, NavigationController } from "@simonbackx/vue-app-navigation";
import { BirthYearInput, DateSelection, ErrorBox, BackButton, RadioGroup, Checkbox, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, AddressInput, Validator, LoadingButton, IBANInput, ImageInput, ColorInput, Toast } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Group, GroupGenderType, GroupPatch, GroupSettings, GroupSettingsPatch, Organization, OrganizationPatch, Address, OrganizationMetaData, Image, ResolutionRequest, ResolutionFit, Version } from "@stamhoofd/structures"
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
        IBANInput,
        ImageInput,
        ColorInput
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

    get squareLogoResolutions() {
        return [
            ResolutionRequest.create({
                height: 44,
                width: 44,
                fit: ResolutionFit.Inside
            }),
            ResolutionRequest.create({
                height: 44*3,
                width: 44*3,
                fit: ResolutionFit.Inside
            })
        ]
    }

    get horizontalLogoResolutions() {
        return [
            ResolutionRequest.create({
                height: 44,
                width: 300,
                fit: ResolutionFit.Inside
            }),
            ResolutionRequest.create({
                height: 44*3,
                width: 300*3,
                fit: ResolutionFit.Inside
            })
        ]
    }

    get color() {
        return this.organization.meta.color
    }

    set color(color: string | null) {
        if (!this.organizationPatch.meta) {
            this.$set(this.organizationPatch, "meta", OrganizationMetaData.patch({}))
        }

        this.organizationPatch.meta.set({
            color
        })
    }

    get squareLogo() {
        return this.organization.meta.squareLogo
    }

    set squareLogo(image: Image | null) {
        if (!this.organizationPatch.meta) {
            this.$set(this.organizationPatch, "meta", OrganizationMetaData.patch({}))
        }

        this.organizationPatch.meta.set({
            squareLogo: image
        })
    }

    get horizontalLogo() {
        return this.organization.meta.horizontalLogo
    }

    set horizontalLogo(image: Image | null) {
        if (!this.organizationPatch.meta) {
            this.$set(this.organizationPatch, "meta", OrganizationMetaData.patch({}))
        }

        this.organizationPatch.meta.set({
            horizontalLogo: image
        })
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

        try {
            await OrganizationManager.patch(this.organizationPatch)
            new Toast('De wijzigingen zijn opgeslagen', "success").setWithOffset().show()
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }

        this.saving = false
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

    shouldNavigateAway() {
        if (!patchContainsChanges(this.organizationPatch, OrganizationManager.organization, { version: Version })) {
            return true;
        }
        if (confirm("Ben je zeker dat je de instellingen wilt sluiten zonder op te slaan?")) {
            return true;
        }
        return false;
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

    .logo-placeholder {
        @extend .style-input;
        @extend .style-input-shadow;
        border: $border-width solid $color-gray-light;
        color: $color-gray;
        background: white;
        border-radius: $border-radius;
        padding: 5px 15px;
        height: 60px;
        margin: 0;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: border-color 0.2s, color 0.2s;
        outline: none;
        -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
        cursor: pointer;
        touch-action: manipulation;


        &:hover {
            border-color: $color-primary-gray-light;
            color: $color-primary;
        }

        &:active {
            border-color: $color-primary;
            color: $color-primary;
        }

        &.square {
            width: 60px;
        }

        &.horizontal {
            width: 300px;
        }
    }
}
</style>
