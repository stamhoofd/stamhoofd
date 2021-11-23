<template>
    <div id="free-contribution-settings-view" class="st-view background">
        <STNavigationBar title="Vrije bijdrage">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else slot="right" class="button icon close gray" @click="pop" />
        </STNavigationBar>

        <main>
            <h1>
                Vrije bijdrage
            </h1>

            <p>
                Je kan bij het inschrijven de mogelijkheid geven om ook een vrije bijdrage (gift) te doen. We tonen dan drie opties waaruit ze kunnen kiezen, waarbij ze ook altijd zelf een bedrag kunnen ingeven. Je kan hieronder de drie standaard bedragen aanpassen. <a class="inline-link" :href="'https://'+$t('shared.domains.marketing')+'/docs/vrije-bijdrage'" target="_blank">Meer info</a>.
            </p>

            <Checkbox v-model="freeContribution">
                Vraag een vrije bijdrage bij het inschrijven (optioneel)
                <p v-if="enableFinancialSupport" class="style-description-small">
                    We slaan deze stap altijd over bij leden met financiële ondersteuning.
                </p>
            </Checkbox>

            <div v-if="freeContribution" class="free-contribution-box">
                <STInputBox title="Beschrijving" class="max">
                    <textarea v-model="freeContributionDescription" class="input" placeholder="Beschrijving bovenaan (bv. verduidelijking waarom je vrije bijdrage vraagt en wat je ermee gaat doen)" />
                </STInputBox>

                <STInputBox title="Standaard opties">
                    <PriceInput :value="getFreeContributionAmounts(0)" placeholder="Optie 1" @input="setFreeContributionAmounts(0, $event)" />
                    <PriceInput :value="getFreeContributionAmounts(1)" placeholder="Optie 2" @input="setFreeContributionAmounts(1, $event)" />
                    <PriceInput :value="getFreeContributionAmounts(2)" placeholder="Optie 3" @input="setFreeContributionAmounts(2, $event)" />
                </STInputBox>
                <p class="style-description-small">
                    Een lid kan naast deze opties altijd 0 euro aanduiden, dat is standaard geselecteerd.
                </p>
            </div>
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
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage, Checkbox, ErrorBox, LoadingButton, PriceInput,Radio, RadioGroup, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, Toast, Validator } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { FreeContributionSettings } from '@stamhoofd/structures';
import { Organization, OrganizationMetaData, OrganizationPatch, OrganizationRecordsConfiguration, Version } from "@stamhoofd/structures"
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../../../classes/OrganizationManager"

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        Checkbox,
        RadioGroup,
        Radio,
        BackButton,
        LoadingButton,
        PriceInput
    },
})
export default class FreeContributionSettingsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false
    temp_organization = OrganizationManager.organization

    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({ id: OrganizationManager.organization.id })

    get organization() {
        return OrganizationManager.organization.patch(this.organizationPatch)
    }

    get enableFinancialSupport() {
        return this.organization.meta.recordsConfiguration.financialSupport !== null
    }

    get freeContribution() {
        return this.organization.meta.recordsConfiguration.freeContribution !== null
    }

    set freeContribution(enable: boolean) {
        if (enable === this.freeContribution) {
            return
        }

        if (enable) {
            this.organizationPatch = this.organizationPatch.patch({
                meta: OrganizationMetaData.patch({
                    recordsConfiguration: OrganizationRecordsConfiguration.patch({
                        freeContribution: FreeContributionSettings.create({})
                    })
                })
            })
        } else {
            this.organizationPatch = this.organizationPatch.patch({
                meta: OrganizationMetaData.patch({
                    recordsConfiguration: OrganizationRecordsConfiguration.patch({
                        freeContribution: null
                    })
                })
            })
        }
    }

    getFreeContributionAmounts(index: number ) {
        return this.organization.meta.recordsConfiguration.freeContribution?.amounts[index] ?? 0
    }

    setFreeContributionAmounts(index: number, amount: number) {
        const amounts = (this.organization.meta.recordsConfiguration.freeContribution?.amounts ?? []).slice(0, 3)
        amounts[index] = amount
        this.organizationPatch = this.organizationPatch.patch({
            meta: OrganizationMetaData.patch({
                recordsConfiguration: OrganizationRecordsConfiguration.patch({
                    freeContribution: FreeContributionSettings.create({
                        description: this.freeContributionDescription,
                        amounts
                    })
                })
            })
        })
    }

    get freeContributionDescription() {
        return this.organization.meta.recordsConfiguration.freeContribution?.description ?? ""
    }

    set freeContributionDescription(description: string) {
        this.organizationPatch = this.organizationPatch.patch({
            meta: OrganizationMetaData.patch({
                recordsConfiguration: OrganizationRecordsConfiguration.patch({
                    freeContribution: FreeContributionSettings.patch({
                        description
                    })
                })
            })
        })
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

    async shouldNavigateAway() {
        if (!patchContainsChanges(this.organizationPatch, OrganizationManager.organization, { version: Version })) {
            return true;
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    mounted() {
        UrlHelper.setUrl("/settings/free-contribution");
    }
}
</script>
