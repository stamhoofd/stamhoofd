<template>
    <div class="boxed-view">
        <div class="st-view">
            <main>
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
import { ComponentWithProperties,HistoryManager,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, LoadingButton, Radio, STErrorsDefault,STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { SessionManager } from '@stamhoofd/networking';
import { CheckoutMethod, CheckoutMethodType, Group, KeychainedResponse, MemberWithRegistrations, Payment, PaymentMethod, PaymentStatus, Record, RecordType, RegisterMember, RegisterMembers, RegisterResponse, SelectedGroup, WebshopTakeoutMethod } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,  Prop,Vue } from "vue-property-decorator";

import { CheckoutManager } from '../../classes/CheckoutManager';
import { WebshopManager } from '../../classes/WebshopManager';
import MemberGeneralView from '../registration/MemberGeneralView.vue';
import AddressSelectionView from './AddressSelectionView.vue';
import { CheckoutStepsManager, CheckoutStepType } from './CheckoutStepsManager';
import TimeSelectionView from './TimeSelectionView.vue';

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
        return WebshopManager.webshop
    }

    get checkoutMethods() {
        return this.webshop.meta.checkoutMethods
    }

    get selectedMethod(): CheckoutMethod {
        if (this.CheckoutManager.checkout.checkoutMethod) {
            const search = this.CheckoutManager.checkout.checkoutMethod.id
            const f = this.webshop.meta.checkoutMethods.find(c => c.id == search)
            if (f) {
                return f
            }
        }
        return this.webshop.meta.checkoutMethods[0]
    }

    set selectedMethod(method: CheckoutMethod) {
        CheckoutManager.checkout.checkoutMethod = method
        CheckoutManager.saveCheckout()
    }

    getTypeName(type: CheckoutMethodType) {
        switch (type) {
            case CheckoutMethodType.Takeout: return "Afhalen";
            case CheckoutMethodType.Delivery: return "Levering";
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
            // Force a save if nothing changed (to fix timeSlot + updated data)
            const nextStep = CheckoutStepsManager.getNextStep(CheckoutStepType.Method)
            if (!nextStep) {
                throw new SimpleError({
                    code: "missing_config",
                    message: "Er ging iets mis bij het ophalen van de volgende stap"
                })
            }
            const comp = await nextStep.getComponent()

            this.show(new ComponentWithProperties(comp, {}))

        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
    }

    mounted() {
        HistoryManager.setUrl(WebshopManager.webshop.getUrlSuffix()+"/checkout/"+CheckoutStepType.Method.toLowerCase())
    }

    activated() {
        // For an unknown reason, we need to set a timer to properly update the URL...
        window.setTimeout(() => {
            HistoryManager.setUrl(WebshopManager.webshop.getUrlSuffix()+"/checkout/"+CheckoutStepType.Method.toLowerCase())
        }, 100);
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>