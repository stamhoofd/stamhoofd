<template>
    <div class="boxed-view">
        <div class="st-view">
            <main>
                <h1>Kies je betaalmethode</h1>

                <STErrorsDefault :error-box="errorBox" />

                <STList>
                    <STListItem v-for="paymentMethod in paymentMethods" :key="paymentMethod" :selectable="true" element-name="label" class="right-stack left-center">
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
            </main>

            <STToolbar>
                <LoadingButton slot="right" :loading="loading">
                    <button class="button primary" @click="goNext">
                        <span>Doorgaan</span>
                        <span class="icon arrow-right" />
                    </button>
                </LoadingButton>
            </STToolbar>
        </div>
    </div>
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
import { Group, KeychainedResponse, MemberWithRegistrations, Payment, PaymentMethod, PaymentStatus, Record, RecordType, RegisterMember, RegisterMembers, RegisterResponse, SelectedGroup, WebshopTakeoutMethod, WebshopTimeSlot, WebshopTimeSlots } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,  Prop,Vue } from "vue-property-decorator";

import { CheckoutManager } from '../../classes/CheckoutManager';
import { WebshopManager } from '../../classes/WebshopManager';
import MemberGeneralView from '../registration/MemberGeneralView.vue';
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
    filters: {
        dateWithDay: (d: Date) => Formatter.capitalizeFirstLetter(Formatter.dateWithDay(d)),
        minutes: Formatter.minutes.bind(Formatter)
    }
})
export default class PaymentSelectionView extends Mixins(NavigationMixin){
    step = -1

    loading = false
    errorBox: ErrorBox | null = null
    CheckoutManager = CheckoutManager

    selectedPaymentMethod: PaymentMethod | null = null

    mounted() {
        this.selectedPaymentMethod = this.paymentMethods[0] ?? null
    }

    get checkoutMethod() {
        return CheckoutManager.checkout.checkoutMethod!
    }

    get webshop() {
        return WebshopManager.webshop
    }
    
    get paymentMethods() {
        const methods = WebshopManager.organization.meta.paymentMethods
        const r: PaymentMethod[] = []

        // Force a given ordering
        if (methods.includes(PaymentMethod.Payconiq)) {
            r.push(PaymentMethod.Payconiq)
        }

        // Force a given ordering
        if (methods.includes(PaymentMethod.iDEAL) && WebshopManager.organization.address.country == "NL") {
            r.push(PaymentMethod.iDEAL)
        }

        // Force a given ordering
        if (methods.includes(PaymentMethod.Bancontact)) {
            r.push(PaymentMethod.Bancontact)
        }

        // Force a given ordering
        if (methods.includes(PaymentMethod.iDEAL) && WebshopManager.organization.address.country == "BE") {
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
        }
    }

    getDescription(paymentMethod: PaymentMethod): string {
        switch (paymentMethod) {
            case PaymentMethod.Payconiq: return "Betaal mobiel met de Payconiq by Bancontact app, de KBC-app of de ING-app."
            case PaymentMethod.Transfer: return ""
            case PaymentMethod.Bancontact: return ""
            case PaymentMethod.iDEAL: return ""
        }
    }

    getLogo(paymentMethod: PaymentMethod): string | null {
        switch (paymentMethod) {
            case PaymentMethod.Payconiq: return payconiqLogo
            case PaymentMethod.Transfer: return null
            case PaymentMethod.Bancontact: return bancontactLogo
            case PaymentMethod.iDEAL: return idealLogo
        }
    }


    async goNext() {
        if (this.loading) {
            return
        }
        this.loading = true

        try {
           // todo
            
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
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