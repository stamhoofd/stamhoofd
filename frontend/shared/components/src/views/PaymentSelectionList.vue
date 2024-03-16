<template>
    <div>
        <STList class="payment-selection-list">
            <STListItem v-for="paymentMethod in sortedPaymentMethods" :key="paymentMethod" :selectable="true" element-name="label" class="right-stack left-center">
                <Radio slot="left" v-model="selectedPaymentMethod" name="choose-payment-method" :value="paymentMethod" />
                <h2 :class="{ 'style-title-list': !!getDescription(paymentMethod) }">
                    {{ getName(paymentMethod) }}

                    <span v-if="paymentMethod == 'Payconiq' && hasNonPayconiq" class="style-tag inline-first">Meest gebruikt</span>
                </h2>
                <p v-if="getDescription(paymentMethod)" class="style-description-small">
                    {{ getDescription(paymentMethod) }}
                </p>

                <div v-if="paymentMethod == 'Payconiq'" class="payment-app-banner">
                    <img class="payment-app-logo" src="~@stamhoofd/assets/images/partners/payconiq/app.svg">
                    <img class="payment-app-logo" src="~@stamhoofd/assets/images/partners/kbc/app.svg">
                    <img class="payment-app-logo" src="~@stamhoofd/assets/images/partners/ing/app.svg">
                    <img class="payment-app-logo" src="~@stamhoofd/assets/images/partners/belfius/app.svg">
                    <img class="payment-app-logo" src="~@stamhoofd/assets/images/partners/bnp/app.png">
                    <img class="payment-app-logo" src="~@stamhoofd/assets/images/partners/hello-bank/app.png">
                    <img class="payment-app-logo" src="~@stamhoofd/assets/images/partners/argenta/app.png">
                </div>

                <img v-if="getLogo(paymentMethod) && (!$isMobile || paymentMethod !== 'Payconiq')" slot="right" :src="getLogo(paymentMethod)" class="payment-method-logo" :class="paymentMethod.toLowerCase()">
            </STListItem>
        </STList>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import bancontactLogo from "@stamhoofd/assets/images/partners/bancontact/logo.svg";
import idealLogo from "@stamhoofd/assets/images/partners/ideal/logo.svg";
import { LoadingButton, Radio, STErrorsDefault, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { Country, Organization, PaymentMethod, PaymentMethodHelper } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Radio,
        LoadingButton,
        STErrorsDefault
    },
    model: {
        // Already vue 3 compliant
        prop: 'modelValue',
        event: 'update:modelValue'
    },
})
export default class PaymentSelectionList extends Mixins(NavigationMixin){
    @Prop({ default: null })
        modelValue: PaymentMethod | null

    @Prop({ required: true }) 
        organization: Organization

    @Prop({ required: true }) 
        paymentMethods: PaymentMethod[]

    @Prop({ default: null }) 
        context: null | "takeout" | "delivery"

    mounted() {
        if (!this.selectedPaymentMethod || this.selectedPaymentMethod === PaymentMethod.Unknown || !this.paymentMethods.includes(this.selectedPaymentMethod)) {
            this.selectedPaymentMethod = this.sortedPaymentMethods[0] ?? null
        }
    }

    get selectedPaymentMethod() {
        return this.modelValue
    }

    set selectedPaymentMethod(method: PaymentMethod | null) {
        this.$emit('update:modelValue', method)
    }

    get sortedPaymentMethods() {
        const methods = this.paymentMethods
        const r: PaymentMethod[] = []

        // Force a given ordering
        if (methods.includes(PaymentMethod.iDEAL) && this.organization.address.country == Country.Netherlands) {
            r.push(PaymentMethod.iDEAL)
        }

        // Force a given ordering
        if (methods.includes(PaymentMethod.Payconiq)) {
            r.push(PaymentMethod.Payconiq)
        }

        // Force a given ordering
        if (methods.includes(PaymentMethod.Bancontact)) {
            r.push(PaymentMethod.Bancontact)
        }

        // Force a given ordering
        if (methods.includes(PaymentMethod.iDEAL) && this.organization.address.country != Country.Netherlands) {
            r.push(PaymentMethod.iDEAL)
        }

        // Force a given ordering
        if (methods.includes(PaymentMethod.CreditCard)) {
            r.push(PaymentMethod.CreditCard)
        }

        // Force a given ordering
        if (methods.includes(PaymentMethod.Transfer)) {
            r.push(PaymentMethod.Transfer)
        }

        // Others
        r.push(...methods.filter(p => p != PaymentMethod.Payconiq && p != PaymentMethod.Bancontact && p != PaymentMethod.iDEAL && p != PaymentMethod.CreditCard && p != PaymentMethod.Transfer))

        return r
    }

    get hasNonPayconiq() {
        const hasTransfer = this.paymentMethods.includes(PaymentMethod.Transfer) ? 1 : 0
        const hasPOS = this.paymentMethods.includes(PaymentMethod.PointOfSale) ? 1 : 0
        return this.paymentMethods.length > 1 || !!hasTransfer || !!hasPOS
    }

    getName(paymentMethod: PaymentMethod): string {
        switch (paymentMethod) {
            case PaymentMethod.Payconiq: return 'Payconiq by Bancontact'
            case PaymentMethod.Transfer: return "Via overschrijving"
            case PaymentMethod.DirectDebit: return "Opgeslagen betaalkaart"
        }
        return PaymentMethodHelper.getNameCapitalized(paymentMethod, this.context)
    }

    getDescription(paymentMethod: PaymentMethod): string {
        switch (paymentMethod) {
            case PaymentMethod.Payconiq: return "Betaal met de Payconiq by Bancontact app, de KBC-app, Belfius, BNP Paribas Fortis, ING-app, Fintro, Hello bank!, Argenta of Crelan app"
            case PaymentMethod.Transfer: return ""
            case PaymentMethod.Bancontact: return this.organization.address.country === Country.Belgium ? "" : ""
            case PaymentMethod.iDEAL: return this.organization.address.country === Country.Netherlands ? "Meest gebruikte betaalmethode." : ""
            case PaymentMethod.Unknown: return ""
            case PaymentMethod.DirectDebit: return "Indien beschikbaar (kan 3 werkdagen duren)"
            case PaymentMethod.CreditCard: return ""
            case PaymentMethod.PointOfSale: return ""
        }
    }

    getLogo(paymentMethod: PaymentMethod): string | null {
        switch (paymentMethod) {
            case PaymentMethod.Payconiq: return null;
            case PaymentMethod.Transfer: return null
            case PaymentMethod.Bancontact: return bancontactLogo
            case PaymentMethod.iDEAL: return idealLogo
            case PaymentMethod.Unknown: return null
            case PaymentMethod.DirectDebit: return null
            case PaymentMethod.CreditCard: return null
            case PaymentMethod.PointOfSale: return null
        }
    }
}
</script>

<style lang="scss">
.payment-selection-list {
    .payment-method-logo {
        max-height: 30px;

        &.bancontact {
            max-height: 38px;
            margin: -4px 0 !important; // Fix white borders in bancontact logo
        }
    }

    .payment-app-logo {
        height: 28px;
        width: 28px;
    }

    .payment-app-banner {
        display: flex;
        flex-direction: row;
        padding-top: 10px;

        > * {
            margin-right: 5px
        }
    }
}

</style>