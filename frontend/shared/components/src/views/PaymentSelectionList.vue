<template>
    <STList>
        <STListItem v-for="paymentMethod in sortedPaymentMethods" :key="paymentMethod" :selectable="true" element-name="label" class="right-stack left-center">
            <Radio slot="left" v-model="selectedPaymentMethod" name="choose-payment-method" :value="paymentMethod" />
            <h2 :class="{ 'style-title-list': !!getDescription(paymentMethod) }">
                {{ getName(paymentMethod) }}
            </h2>
            <p v-if="getDescription(paymentMethod)" class="style-description-small">
                {{ getDescription(paymentMethod) }}
            </p>

            <div v-if="paymentMethod == 'Payconiq' && selectedPaymentMethod == paymentMethod" class="payment-app-banner">
                <img class="payment-app-logo" src="~@stamhoofd/assets/images/partners/payconiq/app.svg">
                <img class="payment-app-logo" src="~@stamhoofd/assets/images/partners/kbc/app.svg">
                <img class="payment-app-logo" src="~@stamhoofd/assets/images/partners/ing/app.svg">
            </div>

            <img v-if="getLogo(paymentMethod)" slot="right" :src="getLogo(paymentMethod)" class="payment-method-logo">
        </STListItem>
    </STList>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import bancontactLogo from "@stamhoofd/assets/images/partners/bancontact/logo.svg"
import idealLogo from "@stamhoofd/assets/images/partners/ideal/logo.svg"
import payconiqLogo from "@stamhoofd/assets/images/partners/payconiq/payconiq-vertical-pos.svg"
import { ErrorBox, LoadingButton, Radio, STErrorsDefault,STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { SessionManager } from '@stamhoofd/networking';
import { Organization, Payment, PaymentMethod, PaymentStatus, Record, RecordType, RegisterMember, RegisterMembers, RegisterResponse, SelectedGroup } from '@stamhoofd/structures';
import { Component, Mixins,  Prop,Vue } from "vue-property-decorator";

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

    mounted() {
        this.selectedPaymentMethod = this.sortedPaymentMethods[0] ?? null
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
        if (methods.includes(PaymentMethod.Payconiq)) {
            r.push(PaymentMethod.Payconiq)
        }

        // Force a given ordering
        if (methods.includes(PaymentMethod.iDEAL) && this.organization.address.country == "NL") {
            r.push(PaymentMethod.iDEAL)
        }

        // Force a given ordering
        if (methods.includes(PaymentMethod.Bancontact)) {
            r.push(PaymentMethod.Bancontact)
        }

        // Force a given ordering
        if (methods.includes(PaymentMethod.iDEAL) && this.organization.address.country == "BE") {
            r.push(PaymentMethod.iDEAL)
        }

        // Others
        r.push(...methods.filter(p => p != PaymentMethod.Payconiq && p != PaymentMethod.Bancontact && p != PaymentMethod.iDEAL))

        return r
    }

    getName(paymentMethod: PaymentMethod): string {
        switch (paymentMethod) {
            case PaymentMethod.Payconiq: return "Payconiq (aangeraden)"
            case PaymentMethod.Transfer: return "Via overschrijving"
            case PaymentMethod.Bancontact: return "Bancontact"
            case PaymentMethod.iDEAL: return "iDEAL"
            case PaymentMethod.Unknown: return "?"
        }
    }

    getDescription(paymentMethod: PaymentMethod): string {
        switch (paymentMethod) {
            case PaymentMethod.Payconiq: return "Betaal mobiel met de Payconiq by Bancontact app, de KBC-app of de ING-app."
            case PaymentMethod.Transfer: return ""
            case PaymentMethod.Bancontact: return ""
            case PaymentMethod.iDEAL: return ""
            case PaymentMethod.Unknown: return ""
        }
    }

    getLogo(paymentMethod: PaymentMethod): string | null {
        switch (paymentMethod) {
            case PaymentMethod.Payconiq: return payconiqLogo
            case PaymentMethod.Transfer: return null
            case PaymentMethod.Bancontact: return bancontactLogo
            case PaymentMethod.iDEAL: return idealLogo
            case PaymentMethod.Unknown: return null
        }
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.payment-method-logo {
    max-height: 30px;
}

.payment-app-logo {
    height: 30px;
}

.payment-app-banner {
    display: flex;
    flex-direction: row;
    padding-top: 10px;

    > * {
        margin-right: 15px
    }
}

</style>