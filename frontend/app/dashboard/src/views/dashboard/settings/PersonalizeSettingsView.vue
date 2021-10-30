<template>
    <div id="personalize-settings-view" class="st-view background">
        <STNavigationBar title="Personaliseren">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else slot="right" class="button icon close gray" @click="pop" />
        </STNavigationBar>

        <main>
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
                Logo groter weergeven
            </Checkbox>
            <p class="st-list-description">
                Heb je een vierkant logo met veel tekst of heb je veel witruimte? Vink dit dan aan, in het andere geval kan je dit beter uitgevinkt laten (want dan wordt het lomp). Sowieso is het verstandig om eerst alle witruimte van je logo weg te knippen voor je het hier uploadt.
            </p>

            <ColorInput v-model="color" title="Hoofdkleur (optioneel)" :validator="validator" placeholder="Geen kleur" :required="false" />
            <p class="st-list-description">
                Vul hierboven de HEX-kleurcode van jouw hoofdkleur in. Laat leeg om de blauwe kleur te behouden.
            </p>

            <hr>
            <h2>Domeinnaam</h2>

            <p>Alle informatie over domeinnaamen vind je op <a class="inline-link" :href="'https://'+$t('shared.domains.marketing')+'/docs/domeinnaam-koppelen'" target="_blank">deze pagina</a>.</p>


            <template v-if="organization.privateMeta && organization.privateMeta.pendingMailDomain">
                <p class="warning-box">
                    Jouw nieuwe domeinnaam ({{ organization.privateMeta.pendingMailDomain }}) is nog niet geactiveerd. Voeg de DNS-records toe en verifieer je wijzigingen om deze te activeren.
                </p>

                <p v-if="enableMemberModule && organization.registerDomain" class="info-box">
                    Jouw domeinnaam voor inschrijvingen is wel al beschikbaar ({{ organization.registerDomain }})
                </p>

                <p class="st-list-description">
                    <button class="button secundary" @click="openRecords">
                        DNS-records instellen en verifiëren
                    </button>
                    <button class="button text" @click="setupDomain">
                        <span class="icon settings" />
                        <span>Wijzigen</span>
                    </button>
                </p>
            </template>

            <template v-else-if="organization.privateMeta && organization.privateMeta.mailDomain">
                <p v-if="enableMemberModule" class="st-list-description">
                    Jouw inschrijvingspagina is bereikbaar via <a class="button inline-link" :href="organization.registerUrl" target="_blank">{{ organization.registerUrl }}</a> en jouw e-mails kunnen worden verstuurd vanaf <strong>@{{ organization.privateMeta.mailDomain }}</strong>.
                </p>
                <p v-else class="st-list-description">
                    Jouw e-mails kunnen worden verstuurd vanaf <strong>@{{ organization.privateMeta.mailDomain }}</strong>.
                </p>
                
                <p v-if="!organization.privateMeta.mailDomainActive" class="warning-box">
                    Jouw e-mail domeinnaam is nog niet actief, deze wordt binnenkort geactiveerd.
                </p>

                <p class="st-list-description">
                    <button class="button text" @click="setupDomain">
                        <span class="icon settings" />
                        <span>Domeinnaam wijzigen</span>
                    </button>
                </p>
            </template>

            <template v-else>
                <p v-if="enableMemberModule" class="st-list-description">
                    Jouw inschrijvingspagina is bereikbaar via <a class="button inline-link" :href="organization.registerUrl" target="_blank">{{ organization.registerUrl }}</a>. {{ $t('dashboard.settings.personalize.domainDescriptionSuffixForMemberRegistrations') }}
                </p>
                <p v-else class="st-list-description">
                    {{ $t('dashboard.settings.personalize.domainDescription') }}
                </p>

                <p class="st-list-description">
                    <button class="button text" @click="setupDomain">
                        <span class="icon settings" />
                        <span>Domeinnaam instellen</span>
                    </button>
                </p>
            </template>
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
import { AutoEncoder, AutoEncoderPatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput, BackButton, CenteredMessage, Checkbox, ColorInput, DateSelection, ErrorBox, FileInput, IBANInput, ImageInput, LoadingButton, Radio, RadioGroup, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, Toast, Validator } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { Image, Organization, OrganizationMetaData, OrganizationPatch, ResolutionFit, ResolutionRequest, Version } from "@stamhoofd/structures";
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager";
import DNSRecordsView from './DNSRecordsView.vue';
import DomainSettingsView from './DomainSettingsView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        Checkbox,
        DateSelection,
        RadioGroup,
        Radio,
        BackButton,
        AddressInput,
        LoadingButton,
        IBANInput,
        ImageInput,
        ColorInput,
        FileInput
    },
})
export default class PersonalizeSettingsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false
    temp_organization = OrganizationManager.organization
    showDomainSettings = true

    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({ id: OrganizationManager.organization.id })

    get organization() {
        return OrganizationManager.organization.patch(this.organizationPatch)
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

    get color() {
        return this.organization.meta.color
    }

    set color(color: string | null) {
        if (!this.organizationPatch.meta) {
            this.$set(this.organizationPatch, "meta", OrganizationMetaData.patch({}))
        }

        this.$set(this.organizationPatch.meta!, "color", color)
    }

    get squareLogo() {
        return this.organization.meta.squareLogo
    }

    set squareLogo(image: Image | null) {
        if (!this.organizationPatch.meta) {
            this.$set(this.organizationPatch, "meta", OrganizationMetaData.patch({}))
        }

        this.$set(this.organizationPatch.meta!, "squareLogo", image)
    }

    get expandLogo() {
        return this.organization.meta.expandLogo
    }

    set expandLogo(enable: boolean) {
        if (!this.organizationPatch.meta) {
            this.$set(this.organizationPatch, "meta", OrganizationMetaData.patch({}))
        }

        this.$set(this.organizationPatch.meta!, "expandLogo", enable)
    }


    get horizontalLogo() {
        return this.organization.meta.horizontalLogo
    }

    set horizontalLogo(image: Image | null) {
        if (!this.organizationPatch.meta) {
            this.$set(this.organizationPatch, "meta", OrganizationMetaData.patch({}))
        }

        this.$set(this.organizationPatch.meta!, "horizontalLogo", image)
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
            await OrganizationManager.patch(this.organizationPatch)
            this.organizationPatch = OrganizationPatch.create({ id: OrganizationManager.organization.id })
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

    async shouldNavigateAway() {
        if (!patchContainsChanges(this.organizationPatch, OrganizationManager.organization, { version: Version })) {
            return true;
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }
   
    mounted() {
        UrlHelper.setUrl("/settings/personalize");
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
        border: $border-width solid $color-gray-light;
        color: $color-gray;
        background: var(--color-white, white);
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
