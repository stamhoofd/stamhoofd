<template>
    <SaveView id="personalize-settings-view" :loading="saving" title="Personaliseren" :disabled="!hasChanges" @save="save">
        <h1>
            Personaliseren
        </h1>
        <p>Als je een logo hebt kan je deze hier toevoegen. Je kan kiezen om een vierkant logo, een horizontaal logo of beide te uploaden. We kiezen dan automatisch het beste logo afhankelijk van de schermgrootte.</p>

        <STErrorsDefault :error-box="errorBox" />

        <div class="split-inputs">
            <div>
                <ImageInput v-model="horizontalLogo" title="Horizontaal logo" :validator="validator" :resolutions="horizontalLogoResolutions" :required="false" />

                <p class="st-list-description">
                    Beter voor grotere schermen.
                </p>
            </div>

            <div>
                <ImageInput v-model="squareLogo" title="Vierkant logo" :validator="validator" :resolutions="squareLogoResolutions" :required="false" />
                <p class="st-list-description">
                    Beter voor op kleine schermen. Laat tekst zoveel mogelijk weg uit dit logo.
                </p>
            </div>
        </div>

        <Checkbox v-model="expandLogo">
            Logo groter weergeven (afgeraden)
        </Checkbox>
        <p class="st-list-description">
            Heb je een vierkant logo met veel tekst of heb je veel witruimte? Vink dit dan aan, in het andere geval kan je dit beter uitgevinkt laten. Sowieso is het verstandig om eerst alle witruimte van je logo weg te knippen voor je het hier uploadt.
        </p>

        <ColorInput v-model="color" title="Hoofdkleur (optioneel)" :validator="validator" placeholder="Geen kleur" :required="false" :disallowed="['#FFFFFF']" />
        <p class="st-list-description">
            Vul hierboven de HEX-kleurcode van jouw hoofdkleur in. Laat leeg om de blauwe kleur te behouden.
        </p>

        <hr>
        <h2>Domeinnaam</h2>

        <p>Alle informatie over domeinnamen vind je op <a class="inline-link" :href="'https://'+$t('shared.domains.marketing')+'/docs/domeinnaam-koppelen/'" target="_blank">deze pagina</a>.</p>

        <template v-if="organization.privateMeta && (organization.privateMeta.mailDomain || organization.privateMeta.pendingMailDomain || organization.privateMeta.pendingRegisterDomain || organization.registerDomain)">
            <p v-if="isMailOk" class="success-box">
                Jouw domeinnaam is correct ingesteld voor het versturen van e-mails. <template v-if="!organization.privateMeta.mailDomainActive">
                    Maar hij wordt momenteel nog niet gebruikt omdat het nog aan het verwerken is, dit kan enkele uren duren.
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
                    Jouw domeinnaam wordt nog niet gebruikt voor jullie inschrijvingsportaal. Je kan dit instellen door onderaan op 'Domeinnaam instellen' te klikken.
                </p>
            </template>

            <p v-if="isMailOk && (isRegisterOk || !enableMemberModule)" class="st-list-description">
                <button class="button text" type="button" @click="setupDomain">
                    <span class="icon settings" />
                    <span>Domeinnaam wijzigen</span>
                </button>
            </p>

            <p v-else class="st-list-description">
                <button class="button text" type="button" @click="setupDomain">
                    <span class="icon settings" />
                    <span>Domeinnaam instellen</span>
                </button>
            </p>
        </template>

        <template v-else>
            <p v-if="organization.registerUrl && enableMemberModule" class="st-list-description">
                Jullie ledenportaal is bereikbaar via <a class="button inline-link" :href="organization.registerUrl" target="_blank">{{ organization.registerUrl }}</a>. {{ $t('dashboard.settings.personalize.domainDescriptionSuffixForMemberRegistrations') }}
            </p>
            <p v-else class="st-list-description">
                {{ $t('dashboard.settings.personalize.domainDescription') }}
            </p>

            <p class="st-list-description">
                <button class="button text" type="button" @click="setupDomain">
                    <span class="icon settings" />
                    <span>Domeinnaam instellen</span>
                </button>
            </p>
        </template>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, PartialWithoutMethods, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";
import { CenteredMessage, Checkbox, ColorInput, ErrorBox, ImageInput, SaveView, STErrorsDefault, Toast, Validator } from "@stamhoofd/components";
import { Image, Organization, OrganizationMetaData, OrganizationPatch, ResolutionFit, ResolutionRequest, Version } from "@stamhoofd/structures";

import DNSRecordsView from './DNSRecordsView.vue';
import DomainSettingsView from './DomainSettingsView.vue';

@Component({
    components: {
        SaveView,
        STErrorsDefault,
        Checkbox,
        ImageInput,
        ColorInput,
    },
    navigation: {
        title: 'Personaliseren',
    }
})
export default class PersonalizeSettingsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false
    temp_organization = this.$organization
    showDomainSettings = true

    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({})
    
    created() {
        this.organizationPatch.id = this.$organization.id
    }

    get organization() {
        return this.$organization.patch(this.organizationPatch)
    }

    get enableMemberModule() {
        return this.organization.meta.modules.useMembers
    }
    
    get squareLogoResolutions() {
        return [
            ResolutionRequest.create({
                height: 50,
                width: 50,
                fit: ResolutionFit.Inside
            }),
            ResolutionRequest.create({
                height: 70,
                width: 70,
                fit: ResolutionFit.Inside
            }),
            ResolutionRequest.create({
                height: 50*3,
                width: 50*3,
                fit: ResolutionFit.Inside
            }),
            ResolutionRequest.create({
                height: 70*3,
                width: 70*3,
                fit: ResolutionFit.Inside
            }),
            ResolutionRequest.create({
                height: 70*3,
                width: 70*3,
                fit: ResolutionFit.Inside
            })
        ]
    }

    get horizontalLogoResolutions() {
        return [
            ResolutionRequest.create({
                height: 50,
                width: 300,
                fit: ResolutionFit.Inside
            }),
            ResolutionRequest.create({
                height: 70,
                width: 300,
                fit: ResolutionFit.Inside
            }),
            ResolutionRequest.create({
                height: 50*3,
                width: 300*3,
                fit: ResolutionFit.Inside
            }),
            ResolutionRequest.create({
                height: 70*3,
                width: 300*3,
                fit: ResolutionFit.Inside
            }),
        ]
    }

    addPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<Organization>>) {
        this.organizationPatch = this.organizationPatch.patch(Organization.patch(patch))
    }

    get color() {
        return this.organization.meta.color
    }

    set color(color: string | null) {
        this.addPatch({
            meta: OrganizationMetaData.patch({
                color: color
            })
        })
    }

    get squareLogo() {
        return this.organization.meta.squareLogo
    }

    set squareLogo(squareLogo: Image | null) {
        this.addPatch({
            meta: OrganizationMetaData.patch({
                squareLogo
            })
        })
    }

    get expandLogo() {
        return this.organization.meta.expandLogo
    }

    set expandLogo(expandLogo: boolean) {
        this.addPatch({
            meta: OrganizationMetaData.patch({
                expandLogo
            })
        })
    }


    get horizontalLogo() {
        return this.organization.meta.horizontalLogo
    }

    set horizontalLogo(horizontalLogo: Image | null) {
        this.addPatch({
            meta: OrganizationMetaData.patch({
                horizontalLogo
            })
        })
    }

    get isMailOk() {
        return this.organization.privateMeta?.pendingMailDomain === null && this.organization.privateMeta?.mailDomain !== null
    } 

    get isRegisterOk() {
        return this.organization.privateMeta?.pendingRegisterDomain === null && this.organization.registerDomain !== null
    } 

    async save() {
        if (this.saving) {
            return;
        }

        const errors = new SimpleErrors()
      
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
            await this.$organizationManager.patch(this.organizationPatch)
            this.organizationPatch = OrganizationPatch.create({ id: this.$organization.id })
            new Toast('De wijzigingen zijn opgeslagen', "success green").show()
            this.dismiss({ force: true })
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
   
    openRecords() {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(DNSRecordsView, {})
        }).setDisplayStyle("popup"))
    }

    get hasChanges() {
        return patchContainsChanges(this.organizationPatch, this.$organization, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true;
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

#personalize-settings-view {
    .logo-placeholder {
        @extend .style-input;
        @extend .style-input-shadow;
        border: $border-width solid $color-border;
        color: $color-gray-5;
        background: $color-background;
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
