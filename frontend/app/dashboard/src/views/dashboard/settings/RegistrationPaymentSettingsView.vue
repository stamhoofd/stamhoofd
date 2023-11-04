<template>
    <SaveView :loading="saving" title="Betaalmethodes" :disabled="!hasChanges" @save="save">
        <h1>
            Betaalmethodes voor inschrijvingen
        </h1>

        <p>Alle informatie over de verschillen tussen elke betaalmethode vind je op <a class="inline-link" :href="'https://'+$t('shared.domains.marketing')+'/docs/betaalmethodes-voor-inschrijvingen-instellen/'" target="_blank">deze pagina</a>.</p>
        
        <STErrorsDefault :error-box="errorBox" />

        <EditPaymentMethodsBox 
            type="registration"
            :organization="organization" 

            :config="config" 
            :private-config="privateConfig" 
            :validator="validator"
            @patch:config="patchConfig($event)" 
            @patch:privateConfig="patchPrivateConfig($event)" 
        />
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, PartialWithoutMethods, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, ErrorBox, IBANInput, LoadingButton, Radio, RadioGroup, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Toast, Validator } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { Country, Organization, OrganizationMetaData, OrganizationPatch, OrganizationPrivateMetaData, PaymentConfiguration, PaymentMethod, PrivatePaymentConfiguration, Version } from "@stamhoofd/structures";
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager";
import EditPaymentMethodsBox from '../../../components/EditPaymentMethodsBox.vue';

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        RadioGroup,
        Radio,
        LoadingButton,
        IBANInput,
        STList,
        STListItem,
        Checkbox,
        EditPaymentMethodsBox
    },
})
export default class RegistrationPaymentSettingsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false
    temp_organization = OrganizationManager.organization
    loadingMollie = false

    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({ id: OrganizationManager.organization.id })

    get organization() {
        return OrganizationManager.organization.patch(this.organizationPatch)
    }

    get isBelgium() {
        return this.organization.address.country == Country.Belgium
    }

    get hasTransfers() {
        return this.organization.meta.paymentMethods.includes(PaymentMethod.Transfer)
    }

    addPatch(patch: AutoEncoderPatchType<Organization>) {
        this.organizationPatch = this.organizationPatch.patch(patch)
    }

    addMetaPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<OrganizationMetaData>>) {
        this.organizationPatch = this.organizationPatch.patch({
            meta: OrganizationMetaData.patch(patch)
        })
    }

    get config() {
        return this.organization.meta.registrationPaymentConfiguration
    }

    patchConfig(patch: AutoEncoderPatchType<PaymentConfiguration>) {
        this.addMetaPatch({
            registrationPaymentConfiguration: patch
        })
    }

    get privateConfig() {
        return this.organization.privateMeta?.registrationPaymentConfiguration ?? PrivatePaymentConfiguration.create({})
    }

    patchPrivateConfig(patch: AutoEncoderPatchType<PrivatePaymentConfiguration>) {
        this.organizationPatch = this.organizationPatch.patch({
            privateMeta: OrganizationPrivateMetaData.patch({
                registrationPaymentConfiguration: patch
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
        // We can clear now
        UrlHelper.shared.clear()
        UrlHelper.setUrl("/settings/registration-payments")
    }
}
</script>