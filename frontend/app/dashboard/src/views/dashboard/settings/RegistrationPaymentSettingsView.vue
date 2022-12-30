<template>
    <SaveView :loading="saving" title="Betaalmethodes" :disabled="!hasChanges" @save="save">
        <h1>
            Betaalmethodes voor inschrijvingen
        </h1>

        <p>Zoek je informatie over alle betaalmethodes, neem dan een kijkje op <a class="inline-link" :href="'https://'+$t('shared.domains.marketing')+'/docs/betaalmethodes-voor-inschrijvingen-instellen/'" target="_blank">deze pagina</a>.</p>
        
        <STErrorsDefault :error-box="errorBox" />

        <EditPaymentMethodsBox :methods="organization.meta.paymentMethods" :organization="organization" :provider-config="registrationProviderConfiguration" @patch="patchPaymentMethods" @patch:providerConfig="patchRegistrationProviderConfiguration($event)" />

        <template v-if="hasTransfers">
            <hr>

            <h2>Overschrijvingen</h2>

            <IBANInput v-model="iban" title="Bankrekeningnummer" :validator="validator" :required="false" />

            <hr>
            <h2>Overschrijvingen, specifiek voor inschrijvingen</h2>

            <STInputBox title="Begunstigde" error-fields="transferSettings.creditor" :error-box="errorBox">
                <input
                    v-model="creditor"
                    class="input"
                    type="text"
                    :placeholder="organization.name"
                    autocomplete=""
                >
            </STInputBox>

            <STInputBox title="Soort mededeling" error-fields="transferSettings.type" :error-box="errorBox" class="max">
                <RadioGroup>
                    <Radio v-for="_type in transferTypes" :key="_type.value" v-model="transferType" :value="_type.value">
                        {{ _type.name }}
                    </Radio>
                </RadioGroup>
            </STInputBox>
            <p class="style-description-small">
                {{ transferTypeDescription }}
            </p>

            <STInputBox v-if="transferType != 'Structured'" :title="transferType == 'Fixed' ? 'Mededeling' : 'Voorvoegsel'" error-fields="transferSettings.prefix" :error-box="errorBox">
                <input
                    v-model="prefix"
                    class="input"
                    type="text"
                    placeholder="bv. Inschrijving"
                    autocomplete=""
                >
            </STInputBox>
            <p class="style-description-small">
                Voorbeeld: “{{ transferExample }}”
            </p>
        </template>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, PatchableArray, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, ErrorBox, IBANInput, LoadingButton, Radio, RadioGroup, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Toast, Validator } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { Country, Organization, OrganizationMetaData, OrganizationPatch, OrganizationPrivateMetaData, PaymentMethod, PaymentProviderConfiguration, TransferDescriptionType, TransferSettings, Version } from "@stamhoofd/structures";
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

    patchPaymentMethods(patch: PatchableArray<PaymentMethod, PaymentMethod, PaymentMethod>) {
        this.organizationPatch = this.organizationPatch.patch({
            meta: OrganizationMetaData.patch({
                paymentMethods: patch
            })
        })
    }

    get transferTypes() {
        return [
            { 
                value: TransferDescriptionType.Structured,
                name: this.$t('shared.transferTypes.structured'),
                description: "Willekeurig aangemaakt. Geen kans op typefouten vanwege validatie in bankapps."
            },
            { 
                value: TransferDescriptionType.Reference,
                name: "Naam van lid/leden",
                description: "Eventueel voorafgegaan door een zelf gekozen woord (zie onder)"
            },
            { 
                value: TransferDescriptionType.Fixed,
                name: "Vaste mededeling",
                description: "Altijd dezelfde mededeling voor alle inschrijvingen. Opgelet: dit kan niet gewijzigd worden als leden de QR-code scannen, voorzie dus zelf geen eigen vervangingen zoals 'inschrijving + naam'!"
            }
        ]
    }

    get transferTypeDescription() {
        return this.transferTypes.find(t => t.value === this.transferType)?.description ?? ""
    }

    get creditor() {
        return this.organization.meta.transferSettings.creditor
    }

    set creditor(creditor: string | null ) {
        this.preparePatchTransferSettings()
        this.$set(this.organizationPatch.meta!.transferSettings!, "creditor", creditor ? creditor : null)
    }

    preparePatchTransferSettings() {
        if (!this.organizationPatch.meta) {
            this.$set(this.organizationPatch, "meta", OrganizationMetaData.patch({}))
        }
        if (!this.organizationPatch.meta!.transferSettings) {
            this.$set(this.organizationPatch.meta!, "transferSettings", TransferSettings.patch({}))
        }
    }

    get iban() {
        return this.organization.meta.transferSettings.iban ?? ""
    }

    set iban(iban: string) {
        this.preparePatchTransferSettings()
        this.$set(this.organizationPatch.meta!.transferSettings!, "iban", iban ? iban : null)
    }

    get registrationProviderConfiguration() {
        return this.organization.privateMeta?.registrationProviderConfiguration ?? PaymentProviderConfiguration.create({})
    }

    patchRegistrationProviderConfiguration(patch: AutoEncoderPatchType<PaymentProviderConfiguration>) {
        this.organizationPatch = this.organizationPatch.patch({
            privateMeta: OrganizationPrivateMetaData.patch({
                registrationProviderConfiguration: patch
            })
        })
    }

    get prefix() {
        return this.organization.meta.transferSettings.prefix
    }

    set prefix(prefix: string | null ) {
        this.preparePatchTransferSettings()
        this.$set(this.organizationPatch.meta!.transferSettings!, "prefix", prefix ? prefix : null)
    }

    get transferType() {
        return this.organization.meta.transferSettings.type
    }

    set transferType(type: TransferDescriptionType ) {
        this.preparePatchTransferSettings()
        this.$set(this.organizationPatch.meta!.transferSettings!, "type", type)
    }

    get transferExample() {
        if (this.transferType == TransferDescriptionType.Structured) {
            if (!this.isBelgium) {
                return "4974 3024 6755 6964"
            }
            return "+++705/1929/77391+++"
        }

        if (this.transferType == TransferDescriptionType.Reference) {
            return (this.prefix ? this.prefix+' ' : '') + "Simon en Andreas Backx"
        }

        return this.prefix
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