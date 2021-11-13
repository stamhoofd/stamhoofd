<template>
    <div class="st-view">
        <STNavigationBar :title="viewTitle">
            <template #left>
                <BackButton v-if="canPop" @click="pop" />
            </template>
            <template #right>
                <button v-if="canDismiss" class="button icon close gray" @click="dismiss" />
            </template>
        </STNavigationBar>

        <main>
            <h1>{{ viewTitle }}</h1>
            <p>Zoek je informatie over alle betaalmethodes, neem dan een kijkje op <a class="inline-link" :href="'https://'+$t('shared.domains.marketing')+'/docs/online-betalen'" target="_blank">deze pagina</a>.</p>

            <STErrorsDefault :error-box="errorBox" />

            <EditPaymentMethodsBox :methods="paymentMethods" :organization="organization" @patch="patchPaymentMethods" />

            <p v-if="isAnyTicketType" class="warning-box">
                Bij overschrijvingen wordt er pas een ticket aangemaakt zodra je manueel de betaling als betaald hebt gemarkeerd in Stamhoofd. Bij online betalingen gaat dat automatisch en krijgt men de tickets onmiddelijk.
            </p>

            <template v-if="enableTransfers">
                <hr>
                <h2>Overschrijvingen</h2>

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
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, DateSelection, IBANInput,LoadingButton,Radio, RadioGroup, STErrorsDefault, STInputBox, STList, STListItem,STNavigationBar,STToolbar,TimeInput,TooltipDirective as Tooltip } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Country, WebshopField, WebshopOnSiteMethod, WebshopTicketType } from '@stamhoofd/structures';
import { AnyCheckoutMethod, CheckoutMethod, PaymentMethod, PrivateWebshop, TransferDescriptionType,TransferSettings,WebshopDeliveryMethod, WebshopMetaData, WebshopTakeoutMethod } from '@stamhoofd/structures';
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from '../../../../classes/OrganizationManager';
import EditPaymentMethodsBox from '../../../../components/EditPaymentMethodsBox.vue';
import WebshopRolePermissionRow from '../../admins/WebshopRolePermissionRow.vue';
import EditWebshopMixin from './EditWebshopMixin';
import WebshopFieldsBox from './fields/WebshopFieldsBox.vue';
import EditDeliveryMethodView from './locations/EditDeliveryMethodView.vue';
import EditTakeoutMethodView from './locations/EditTakeoutMethodView.vue';

@Component({
    components: {
        STListItem,
        STList,
        STInputBox,
        STErrorsDefault,
        Checkbox,
        IBANInput,
        DateSelection,
        TimeInput,
        RadioGroup,
        Radio,
        WebshopRolePermissionRow,
        WebshopFieldsBox,
        EditPaymentMethodsBox,
        STNavigationBar,
        STToolbar,
        LoadingButton,
        BackButton

    },
    directives: { Tooltip },
})
export default class EditWebshopPaymentMethodsView extends Mixins(EditWebshopMixin) {
    get viewTitle() {
        return "Betaalmethodes"
    }

    get isAnyTicketType() {
        return (this.webshop.meta.ticketType !== WebshopTicketType.None)
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
                description: "Altijd dezelfde mededeling voor alle bestellingen. Opgelet: dit kan niet gewijzigd worden als bestellers de QR-code scannen, voorzie dus zelf geen eigen vervangingen zoals 'bestelling + naam'!"
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
        if (this.transferType == TransferDescriptionType.Structured) {
            if (!this.isBelgium) {
                return "4974 3024 6755 6964"
            }
            return "+++705/1929/77391+++"
        }

        if (this.transferType == TransferDescriptionType.Reference) {
            return (this.prefix ? this.prefix+' ' : '') + "152"
        }

        return this.prefix
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
