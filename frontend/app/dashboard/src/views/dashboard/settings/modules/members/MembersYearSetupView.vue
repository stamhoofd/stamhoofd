<template>
    <div id="personalize-settings-view" class="st-view background">
        <STNavigationBar title="Werkjaar" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1>
                Werkjaar
            </h1>
            <p>Je kan later uitzonderingen voor bepaalde groepen toevoegen indien nodig.</p>

            <STErrorsDefault :error-box="errorBox" />

            <div class="split-inputs">
                <STInputBox title="Inschrijven start op" error-fields="settings.startDate" :error-box="errorBox">
                    <DateSelection v-model="startDate" />
                </STInputBox>
                <TimeInput v-model="startDate" title="Vanaf" :validator="validator" /> 
            </div>
            

            <div class="split-inputs">
                <STInputBox title="Inschrijven sluit op" error-fields="settings.endDate" :error-box="errorBox">
                    <DateSelection v-model="endDate" />
                </STInputBox>
                <TimeInput v-model="endDate" title="Tot welk tijdstip" :validator="validator" />
            </div>
            <p class="st-list-description">
                Als de inschrijvingen het hele jaar doorlopen, vul dan hier gewoon een datum in ergens op het einde van het jaar. Let op het jaartal.
            </p>
        </main>

        <STToolbar>
            <template #right>
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
import { AutoEncoder, AutoEncoderPatchType, PartialWithoutMethods, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage, Checkbox, DateSelection, ErrorBox, LoadingButton, Radio, RadioGroup, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, TimeInput, Validator} from "@stamhoofd/components";
import { Organization, OrganizationMetaData, OrganizationPatch, Version } from "@stamhoofd/structures"
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";


import MembersPriceSetupView from './MembersPriceSetupView.vue';

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
        TimeInput,
        LoadingButton,
    },
})
export default class MembersYearSetupView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false
    temp_organization = this.$organization

    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({ id: this.$organization.id })

    get organization() {
        return this.$organization.patch(this.organizationPatch)
    }

    get startDate() {
        return this.organization.meta.defaultStartDate
    }

    set startDate(defaultStartDate: Date) {
        this.addMetaPatch({ defaultStartDate })
    }

    get endDate() {
        return this.organization.meta.defaultEndDate
    }

    set endDate(defaultEndDate: Date) {
        this.addMetaPatch({ defaultEndDate })
    }

    addMetaPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<OrganizationMetaData>> ) {
        this.organizationPatch = this.organizationPatch.patch(OrganizationPatch.create({ 
            meta: OrganizationMetaData.patch(patch)
        }))
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
            this.show(new ComponentWithProperties(MembersPriceSetupView, {}))
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }

        this.saving = false
    }

    async shouldNavigateAway() {
        if (!patchContainsChanges(this.organizationPatch, this.$organization, { version: Version })) {
            return true;
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }
}
</script>