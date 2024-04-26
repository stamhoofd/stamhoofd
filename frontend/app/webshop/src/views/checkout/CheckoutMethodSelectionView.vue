<template>
    <SaveView title="Kies je afhaalmethode" :loading="loading" save-icon-right="arrow-right" save-text="Doorgaan" :prefer-large-button="true" @save="goNext">
        <h1>Kies je afhaalmethode</h1>

        <STErrorsDefault :error-box="errorBox" />

        <STList>
            <STListItem v-for="checkoutMethod in checkoutMethods" :key="checkoutMethod.id" :selectable="true" element-name="label" class="right-stack left-center">
                <Radio slot="left" v-model="selectedMethod" name="choose-checkout-method" :value="checkoutMethod" />
                <h2 class="style-title-list">
                    {{ getTypeName(checkoutMethod.type) }}: {{ checkoutMethod.name }}
                </h2>
                <p class="style-description-small">
                    {{ checkoutMethod.description || checkoutMethod.address || "" }}
                </p>
                <p v-if="checkoutMethod.timeSlots.timeSlots.length == 1" class="style-description-small">
                    {{ checkoutMethod.timeSlots.timeSlots[0].date | date | capitalizeFirstLetter }} tussen {{ checkoutMethod.timeSlots.timeSlots[0].startTime | minutes }} - {{ checkoutMethod.timeSlots.timeSlots[0].endTime | minutes }}
                </p>

                <template v-if="checkoutMethod.timeSlots.timeSlots.length == 1">
                    <span v-if="checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock === 0" slot="right" class="style-tag error">Volzet</span>
                    <span v-else-if="checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock !== null" slot="right" class="style-tag">Nog {{ checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock }} {{ checkoutMethod.timeSlots.timeSlots[0].remainingPersons !== null ? (checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock == 1 ? "persoon" : "personen") : (checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock == 1 ? "plaats" : "plaatsen") }}</span>
                </template>
            </STListItem>
        </STList>
    </SaveView>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, Radio, SaveView, STErrorsDefault, STList, STListItem } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { CheckoutMethod, CheckoutMethodType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins } from "vue-property-decorator";

import { CheckoutManager } from '../../classes/CheckoutManager';
import { WebshopManager } from '../../classes/WebshopManager';
import { CheckoutStepsManager, CheckoutStepType } from './CheckoutStepsManager';

@Component({
    components: {
        STList,
        STListItem,
        Radio,
        STErrorsDefault,
        SaveView
    },
    filters: {
        date: Formatter.dateWithDay.bind(Formatter),
        minutes: Formatter.minutes.bind(Formatter),
        capitalizeFirstLetter: Formatter.capitalizeFirstLetter.bind(Formatter)
    }
})
export default class CheckoutMethodSelectionView extends Mixins(NavigationMixin){
    step = -1

    loading = false
    errorBox: ErrorBox | null = null

    CheckoutManager = CheckoutManager

    get webshop() {
        return this.$webshopManager.webshop
    }

    get checkoutMethods() {
        return this.webshop.meta.checkoutMethods
    }

    get selectedMethod(): CheckoutMethod {
        if (this.$checkoutManager.checkout.checkoutMethod) {
            const search = this.$checkoutManager.checkout.checkoutMethod.id
            const f = this.webshop.meta.checkoutMethods.find(c => c.id == search)
            if (f) {
                return f
            }
        }
        return this.webshop.meta.checkoutMethods[0]
    }

    set selectedMethod(method: CheckoutMethod) {
        this.$checkoutManager.checkout.checkoutMethod = method
        this.$checkoutManager.saveCheckout()
    }

    getTypeName(type: CheckoutMethodType) {
        switch (type) {
            case CheckoutMethodType.Takeout: return "Afhalen";
            case CheckoutMethodType.Delivery: return "Levering";
            case CheckoutMethodType.OnSite: return "Ter plaatse";
        }
    }
    
    async goNext() {
        if (this.loading || !this.selectedMethod) {
            return
        }
        // Force checkout save
        this.selectedMethod = this.selectedMethod as any

        this.loading = true
        this.errorBox = null

        try {
            await CheckoutStepsManager.for(this.$checkoutManager).goNext(CheckoutStepType.Method, this)
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
    }

    mounted() {
        UrlHelper.setUrl("/checkout/"+CheckoutStepType.Method.toLowerCase())
    }
}
</script>

