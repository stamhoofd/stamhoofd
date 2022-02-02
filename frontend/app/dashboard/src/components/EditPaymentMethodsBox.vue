<template>
    <STList>
        <STListItem v-for="method in sortedPaymentMethods" :key="method" :selectable="true" element-name="label">
            <Checkbox slot="left" :checked="getPaymentMethod(method)" @change="setPaymentMethod(method, $event)" />
            <h3 class="style-title-list">
                {{ getName(method) }}
            </h3>
            <p class="style-description pre-wrap" v-text="getDescription(method)" />
        </STListItem>
    </STList>
</template>


<script lang="ts">
import { PatchableArray } from "@simonbackx/simple-encoding";
import bancontactLogo from "@stamhoofd/assets/images/partners/bancontact/logo.svg";
import idealLogo from "@stamhoofd/assets/images/partners/ideal/logo.svg";
import payconiqLogo from "@stamhoofd/assets/images/partners/payconiq/payconiq-vertical-pos.svg";
import { Checkbox, STList, STListItem, Toast } from "@stamhoofd/components";
import { I18nController } from "@stamhoofd/frontend-i18n";
import { Country, Organization, PaymentMethod, PaymentMethodHelper } from "@stamhoofd/structures";
import { Component, Prop, Vue } from "vue-property-decorator";

@Component({
    components: {
        Checkbox,
        STList,
        STListItem
    },
})
export default class EditPaymentMethodsBox extends Vue {
    @Prop({ required: true })
    organization: Organization

    @Prop({ required: true })
    methods: PaymentMethod[]
    
    get country() {
        return I18nController.shared.country
    }

    get sortedPaymentMethods() {
        const r: PaymentMethod[] = [
            PaymentMethod.Transfer
        ]

        // Force a given ordering
        if (this.country == Country.Netherlands) {
            r.push(PaymentMethod.iDEAL)
        }

        // Force a given ordering
        if (this.country == Country.Belgium || this.getPaymentMethod(PaymentMethod.Payconiq)) {
            r.push(PaymentMethod.Payconiq)
        }

        // Force a given ordering
        r.push(PaymentMethod.Bancontact)

        // Force a given ordering
        if (this.country != Country.Netherlands) {
            r.push(PaymentMethod.iDEAL)
        }

        r.push(PaymentMethod.CreditCard)
        r.push(PaymentMethod.PointOfSale)
        return r
    }

    getName(paymentMethod: PaymentMethod): string {
        return PaymentMethodHelper.getNameCapitalized(paymentMethod)
    }

    getDescription(paymentMethod: PaymentMethod): string {
        switch (paymentMethod) {
            case PaymentMethod.Transfer: return "Gratis, maar je moet elke betaling zelf controleren en markeren als betaald in Stamhoofd"
            case PaymentMethod.Payconiq: return "€ 0,20 / transactie"
            case PaymentMethod.Bancontact: return "€ 0,31 / transactie"
            case PaymentMethod.iDEAL: return "€ 0,29 / transactie"
            case PaymentMethod.CreditCard: return "€ 0,25 + 1,8% voor persoonlijke kaarten (Europese Unie)\n€ 0,25 + 2,8% voor zakelijke of buiten-EU kaarten"
            case PaymentMethod.Unknown: return ""
            case PaymentMethod.DirectDebit: return ""
            case PaymentMethod.PointOfSale: return "Gratis, maar af te raden omdat je veel voordelen verliest."
        }
    }

    getLogo(paymentMethod: PaymentMethod): string | null {
        switch (paymentMethod) {
            case PaymentMethod.Payconiq: return payconiqLogo
            case PaymentMethod.Transfer: return null
            case PaymentMethod.Bancontact: return bancontactLogo
            case PaymentMethod.iDEAL: return idealLogo
            case PaymentMethod.Unknown: return null
            case PaymentMethod.DirectDebit: return null
            case PaymentMethod.CreditCard: return null
            case PaymentMethod.PointOfSale: return null
        }
    }

    getPaymentMethod(method: PaymentMethod) {
        return this.methods.includes(method)
    }

    setPaymentMethod(method: PaymentMethod, enabled: boolean) {
        if (enabled === this.getPaymentMethod(method)) {
            return
        }
        
        const arr = new PatchableArray<PaymentMethod, PaymentMethod, PaymentMethod>()
        if (enabled) {
            const errorMessage = this.getEnableErrorMessage(method)
            if (errorMessage) {
                new Toast(errorMessage, "error red").setHide(15*1000).show()
                return
            }
            arr.addPut(method)
        } else {
            if (this.methods.length == 1) {
                new Toast("Je moet minimaal één betaalmethode accepteren", "error red").show();
                return
            }

            arr.addDelete(method)
        }

        this.$emit('patch', arr)
    }

    getEnableErrorMessage(paymentMethod: PaymentMethod): string | undefined {
        switch (paymentMethod) {
            case PaymentMethod.Payconiq: {
                if ((this.organization.privateMeta?.payconiqApiKey ?? "").length == 0) {
                    return "Om Payconiq te activeren moet je eerst de API-key van Payconiq ingeven bij jouw instellingen. Daar vind je ook meer informatie over hoe je die kan krijgen."
                }
                break
            }

            case PaymentMethod.iDEAL:
            case PaymentMethod.CreditCard:
            case PaymentMethod.Bancontact: {
                if (!this.organization.privateMeta?.mollieOnboarding || !this.organization.privateMeta.mollieOnboarding.canReceivePayments) {
                    return "Je kan "+PaymentMethodHelper.getName(paymentMethod)+" niet activeren, daarvoor moet je eerst Mollie koppelen via de Stamhoofd instellingen."
                }
                break
            }
        }
    }


}
</script>