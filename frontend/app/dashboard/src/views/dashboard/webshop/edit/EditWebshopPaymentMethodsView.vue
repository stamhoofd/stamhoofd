<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>{{ viewTitle }}</h1>
        <p>Zoek je informatie over alle betaalmethodes, neem dan een kijkje op <a class="inline-link" :href="'https://'+$t('shared.domains.marketing')+'/docs/betaalmethodes-voor-webshops-instellen/'" target="_blank">deze pagina</a>.</p>

        <STErrorsDefault :error-box="errorBox" />

        <EditPaymentMethodsBox :methods="paymentMethods" :organization="organization" :provider-config="providerConfig" @patch="patchPaymentMethods" @patch:providerConfig="patchProviderConfiguration($event)" />

        <template v-if="enableTransfers">
            <hr>
            <h2>Overschrijvingen</h2>

            <p v-if="isAnyTicketType" class="warning-box">
                Bij overschrijvingen wordt er pas een ticket aangemaakt zodra je manueel de betaling als betaald hebt gemarkeerd in Stamhoofd. Bij online betalingen gaat dat automatisch en krijgt men de tickets onmiddellijk.
            </p>


            <STInputBox title="Begunstigde" error-fields="transferSettings.creditor" :error-box="errorBox">
                <input
                    v-model="creditor"
                    class="input"
                    type="text"
                    :placeholder="organization.meta.transferSettings.creditor || organization.name"
                    autocomplete=""
                >
            </STInputBox>

            <IBANInput v-model="iban" title="Bankrekeningnummer" :placeholder="organization.meta.transferSettings.iban || 'Op deze rekening schrijft men over'" :validator="validator" :required="false" />

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

            <p v-if="transferType === 'Fixed'" class="style-description-small">
                Gebruik automatische tekstvervangingen in de mededeling via <code v-copyable class="style-inline-code style-copyable" v-text="`{{naam}}`" />, <code v-copyable class="style-inline-code style-copyable" v-text="`{{email}}`" /> of <code v-copyable class="style-inline-code style-copyable" v-text="`{{nr}}`" />
            </p>

            <STInputBox v-if="transferType != 'Structured'" :title="transferType == 'Fixed' ? 'Mededeling' : 'Voorvoegsel'" error-fields="transferSettings.prefix" :error-box="errorBox">
                <input
                    v-model="prefix"
                    class="input"
                    type="text"
                    placeholder="bv. Bestelling"
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
import { PatchableArray } from '@simonbackx/simple-encoding';
import { IBANInput, Radio, RadioGroup, SaveView, STErrorsDefault, STInputBox } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Country, PaymentMethod, PaymentProviderConfiguration, PrivateWebshop, TransferDescriptionType, TransferSettings, WebshopMetaData, WebshopPrivateMetaData, WebshopTicketType } from '@stamhoofd/structures';
import { Component, Mixins } from "vue-property-decorator";

import EditPaymentMethodsBox from '../../../../components/EditPaymentMethodsBox.vue';
import EditWebshopMixin from './EditWebshopMixin';

@Component({
    components: {
        STInputBox,
        STErrorsDefault,
        IBANInput,
        RadioGroup,
        Radio,
        EditPaymentMethodsBox,
        SaveView
    },
})
export default class EditWebshopPaymentMethodsView extends Mixins(EditWebshopMixin) {
    get viewTitle() {
        return "Betaalmethodes"
    }

    get isAnyTicketType() {
        return (this.webshop.meta.ticketType !== WebshopTicketType.None)
    }

    get providerConfig() {
        return this.webshop.privateMeta.providerConfiguration
    }

    patchProviderConfiguration(patch: PaymentProviderConfiguration) {
        const p = PrivateWebshop.patch({})
        p.privateMeta = WebshopPrivateMetaData.patch({
            providerConfiguration: patch
        })
        this.addPatch(p)
    }

    get organization() {
        return SessionManager.currentSession!.organization!
    }

    get transferTypes() {
        return [
            { 
                value: TransferDescriptionType.Structured,
                name: this.$t('shared.transferTypes.structured'),
                description: "Willekeurig aangemaakt. Geen kans op typefouten vanwege validatie in bankapps"
            },
            { 
                value: TransferDescriptionType.Reference,
                name: "Bestelnummer",
                description: "Eventueel voorafgegaan door een zelf gekozen woord (zie onder)"
            },
            { 
                value: TransferDescriptionType.Fixed,
                name: "Vaste mededeling",
                description: "Altijd dezelfde mededeling voor alle bestellingen. Opgelet: dit kan niet gewijzigd worden als bestellers de QR-code scannen, voorzie dus zelf geen eigen vervangingen zoals 'bestelling + naam', maar gebruik de beschikbare automatische vervangingen indien gewenst (bv. 'bestelling {{naam}}')!"
            }
        ]
    }

    get transferTypeDescription() {
        return this.transferTypes.find(t => t.value === this.transferType)?.description ?? ""
    }

    get creditor() {
        return this.webshop.meta.transferSettings.creditor
    }

    set creditor(creditor: string | null ) {
        const p = PrivateWebshop.patch({})
        p.meta = WebshopMetaData.patch({ 
            transferSettings: TransferSettings.patch({
                creditor: !creditor || creditor.length == 0 || creditor == (this.organization.meta.transferSettings.creditor ?? this.organization.name) ? null : creditor
            })
        })
        this.addPatch(p)
    }

    get iban() {
        return this.webshop.meta.transferSettings.iban
    }

    set iban(iban: string | null ) {
        const p = PrivateWebshop.patch({})
        p.meta = WebshopMetaData.patch({ 
            transferSettings: TransferSettings.patch({
                iban: !iban || iban.length == 0 || iban == this.organization.meta.transferSettings.iban ? null : iban
            })
        })
        this.addPatch(p)
    }

    get prefix() {
        return this.webshop.meta.transferSettings.prefix
    }

    set prefix(prefix: string | null ) {
        const p = PrivateWebshop.patch({})
        p.meta = WebshopMetaData.patch({ 
            transferSettings: TransferSettings.patch({
                prefix
            })
        })
        this.addPatch(p)
    }

    get transferType() {
        return this.webshop.meta.transferSettings.type
    }

    set transferType(type: TransferDescriptionType ) {
        const p = PrivateWebshop.patch({})
        p.meta = WebshopMetaData.patch({ 
            transferSettings: TransferSettings.patch({
                type
            })
        })
        this.addPatch(p)
    }

    get isBelgium() {
        return this.organization.address.country == Country.Belgium
    }

    get transferExample() {
        const fakeReference = "152";
        const settings = this.webshop.meta.transferSettings

        return settings.generateDescription(fakeReference, this.organization.address.country, {
            nr: fakeReference,
            email: this.$t('shared.exampleData.email').toString(),
            phone: this.$t('shared.exampleData.phone').toString(),
            name: this.$t('shared.exampleData.name').toString(),
            naam: this.$t('shared.exampleData.name').toString(),
        })
    }

    get enableTransfers() {
        return this.webshop.meta.paymentMethods.includes(PaymentMethod.Transfer)
    }

    get paymentMethods() {
        return this.webshop.meta.paymentMethods
    }

    patchPaymentMethods(patch: PatchableArray<PaymentMethod, PaymentMethod, PaymentMethod>) {
        this.addPatch(PrivateWebshop.patch({
            meta: WebshopMetaData.patch({
                paymentMethods: patch
            })
        }))
    }
}
</script>
