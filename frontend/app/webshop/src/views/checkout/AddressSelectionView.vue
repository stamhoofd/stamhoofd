<template>
    <SaveView title="Kies je leveringsadres" :loading="loading" save-icon-right="arrow-right" save-text="Doorgaan" data-submit-last-field @save="goNext">
        <h1>Kies je leveringsadres</h1>
        <div v-if="deliveryMethod && deliveryMethod.price.minimumPrice !== null && deliveryMethod.price.discountPrice !== checkout.deliveryPrice" class="info-box">
            Bestel minimum {{ formatPrice(deliveryMethod.price.minimumPrice) }} om van een verlaagde leveringskost van {{ formatPrice(deliveryMethod.price.discountPrice) }} te genieten.
        </div>

        <p v-if="checkout.deliveryPrice === 0" class="success-box">
            Levering is gratis
            <template v-if="deliveryMethod && deliveryMethod.price.minimumPrice !== null && deliveryMethod.price.price !== 0" class="info-box">
                vanaf een bestelbedrag van {{ formatPrice(deliveryMethod.price.minimumPrice) }}.
            </template>
        </p>
        <p v-else class="info-box">
            De leveringskost bedraagt {{ formatPrice(checkout.deliveryPrice) }}
            <template v-if="deliveryMethod && deliveryMethod.price.minimumPrice !== null && deliveryMethod.price.discountPrice === checkout.deliveryPrice" class="info-box">
                vanaf een bestelbedrag van {{ formatPrice(deliveryMethod.price.minimumPrice) }}.
            </template>
        </p>

        <STErrorsDefault :error-box="errorBox" />

        <AddressInput v-model="address" :required="true" title="Vul het leveringsadres in" :validator="validator" :validate-server="unscopedServer" />
    </SaveView>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";
import { AddressInput, ErrorBox, SaveView, STErrorsDefault, STList, STListItem, Validator } from "@stamhoofd/components";
import { Address, ValidatedAddress } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { CheckoutManager } from '../../classes/CheckoutManager';
import { CheckoutStepsManager, CheckoutStepType } from './CheckoutStepsManager';

@Component({
    components: {
        STList,
        STListItem,
        STErrorsDefault,
        AddressInput,
        SaveView
    },
    filters: {
        dateWithDay: (d: Date) => Formatter.capitalizeFirstLetter(Formatter.dateWithDay(d)),
        minutes: Formatter.minutes.bind(Formatter),
        price: Formatter.price.bind(Formatter)
    }
})
export default class AddressSelectionView extends Mixins(NavigationMixin){
    step = -1

    loading = false
    errorBox: ErrorBox | null = null
    validator = new Validator()
    CheckoutManager = CheckoutManager

    get checkoutMethod() {
        return this.$checkoutManager.checkout.checkoutMethod!
    }

    get deliveryMethod() {
        return this.$checkoutManager.checkout.deliveryMethod
    }

    get checkout() {
        return this.$checkoutManager.checkout
    }

    get webshop() {
        return this.$webshopManager.webshop
    }

    get address() {
        return this.$checkoutManager.checkout.address
    }

    set address(address: ValidatedAddress | Address | null) {
        if (address instanceof ValidatedAddress) {
            this.$checkoutManager.checkout.address = address
            this.$checkoutManager.saveCheckout()
        }
    } 

    get unscopedServer() {
        return this.$webshopManager.unscopedServer
    }

    async goNext() {
        if (this.loading) {
            return
        }
        this.loading = true

        if (!await this.validator.validate()) {
            this.loading = false
            return
        }
        this.errorBox = null

        try {
            await CheckoutStepsManager.for(this.$checkoutManager).goNext(CheckoutStepType.Address, this)
            
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
    }
}
</script>
