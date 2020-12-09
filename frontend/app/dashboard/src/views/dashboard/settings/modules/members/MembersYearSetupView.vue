<template>
    <div id="personalize-settings-view" class="st-view background">
        <STNavigationBar title="Werkjaar">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else class="button icon close gray" @click="pop" slot="right" />
        </STNavigationBar>

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
            <template slot="right">
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
import { AutoEncoder, AutoEncoderPatchType, Decoder, PartialWithoutMethods, PatchableArray,patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, HistoryManager,NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { TimeInput, BackButton, CenteredMessage, Checkbox, ColorInput, DateSelection, ErrorBox, FileInput,IBANInput, ImageInput, LoadingButton, Radio, RadioGroup, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, Toast, Validator} from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Address, File, Image, Organization, OrganizationMetaData, OrganizationPatch, OrganizationPrivateMetaData,PaymentMethod, ResolutionFit, ResolutionRequest, Version } from "@stamhoofd/structures"
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../../../classes/OrganizationManager"
import DNSRecordsView from './DNSRecordsView.vue';
import DomainSettingsView from './DomainSettingsView.vue';
import EmailSettingsView from './EmailSettingsView.vue';
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
    temp_organization = OrganizationManager.organization

    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({ id: OrganizationManager.organization.id })

    get organization() {
        return OrganizationManager.organization.patch(this.organizationPatch)
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
            await OrganizationManager.patch(this.organizationPatch)
            this.organizationPatch = OrganizationPatch.create({ id: OrganizationManager.organization.id })
            this.show(new ComponentWithProperties(MembersPriceSetupView, {}))
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
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

</style>
