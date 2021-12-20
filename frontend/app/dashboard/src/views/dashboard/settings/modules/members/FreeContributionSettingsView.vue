<template>
    <SaveView :loading="saving" title="Vrije bijdrage" :disabled="!hasChanges" @save="save">
        <h1>
            Vrije bijdrage
        </h1>

        <p>
            Je kan bij het inschrijven de mogelijkheid geven om ook een vrije bijdrage (gift) te doen. Een lid kan dan kiezen uit 0 euro, enkele voorgestelde bedragen of een eigen gekozen bedrag. <a class="inline-link" :href="'https://'+$t('shared.domains.marketing')+'/docs/vrije-bijdrage'" target="_blank">Meer info</a>.
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

            <STInputBox v-for="n in amountCount" :key="n" :title="'Voorgesteld bedrag '+n">
                <PriceInput :value="getFreeContributionAmounts(n - 1)" :placeholder="'Optie '+n" @input="setFreeContributionAmounts(n - 1, $event)" />

                <button slot="right" class="button icon trash gray" type="button" @click="deleteOption(n - 1)" />
            </STInputBox>

            <p v-if="amountCount == 0" class="info-box">
                Er zijn geen voorgestelde bedragen. Een lid kan enkel zelf een bedrag ingeven.
            </p>

            <button class="button text" type="button" @click="addOption">
                <span class="icon add" />
                <span>Voorgesteld bedrag</span>
            </button>

            <p class="style-description-small">
                Een lid kan naast deze opties altijd 0 euro aanduiden (dat is standaard geselecteerd) of zelf een bedrag ingeven.
            </p>
        </div>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, ErrorBox, PriceInput, SaveView, STErrorsDefault, STInputBox, Toast, Validator } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { FreeContributionSettings, Organization, OrganizationMetaData, OrganizationPatch, OrganizationRecordsConfiguration, Version } from '@stamhoofd/structures';
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../../../classes/OrganizationManager";

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        Checkbox,
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

    get amountCount() {
        return this.organization.meta.recordsConfiguration.freeContribution?.amounts?.length ?? 0
    }

    getFreeContributionAmounts(index: number ) {
        return this.organization.meta.recordsConfiguration.freeContribution?.amounts[index] ?? 0
    }

    setFreeContributionAmounts(index: number, amount: number) {
        const amounts = (this.organization.meta.recordsConfiguration.freeContribution?.amounts ?? []).slice()
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

    deleteOption(index: number) {
        const amounts = (this.organization.meta.recordsConfiguration.freeContribution?.amounts ?? []).slice()
        amounts.splice(index, 1)
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


    addOption() {
        const last = this.organization.meta.recordsConfiguration.freeContribution?.amounts?.slice(-1)[0] ?? 0
        const amounts = (this.organization.meta.recordsConfiguration.freeContribution?.amounts ?? []).slice()
        amounts.push(last + 10*100)
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

    get hasChanges() {
        return patchContainsChanges(this.organizationPatch, OrganizationManager.organization, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true;
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    mounted() {
        UrlHelper.setUrl("/settings/free-contribution");
    }
}
</script>
