<template>
    <div class="st-view boxed">
        <STNavigationBar :large="true">
            <BackButton v-if="canPop" slot="left" @click="pop" />
        </STNavigationBar>

        <div class="box">
            <main>
                <h1 v-if="checkoutMethod.type == 'Takeout'">
                    Kies je afhaaltijdstip
                </h1>
                <h1 v-else-if="checkoutMethod.type == 'Delivery'">
                    Kies je leveringstijdstip
                </h1>

                <p v-if="checkoutMethod.type == 'Takeout'">
                    Afhaallocatie: {{ checkoutMethod.name ? checkoutMethod.name + ',' : '' }} {{ checkoutMethod.address }}
                </p>
                
                <STErrorsDefault :error-box="errorBox" />

                <STList>
                    <STListItem v-for="(slot, index) in timeSlots" :key="index" :selectable="true" element-name="label" class="right-stack left-center">
                        <Radio slot="left" v-model="selectedSlot" name="choose-time-slot" :value="slot" />
                        <h2 class="style-title-list">
                            {{ slot.date | dateWithDay }}
                        </h2> 
                        <p class="style-description">
                            Tussen {{ slot.startTime | minutes }} - {{ slot.endTime | minutes }}
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
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties,HistoryManager, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, ErrorBox, LoadingButton, Radio, STErrorsDefault,STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { WebshopTimeSlot } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins } from "vue-property-decorator";

import { CheckoutManager } from '../../classes/CheckoutManager';
import { WebshopManager } from '../../classes/WebshopManager';
import { CheckoutStepsManager, CheckoutStepType } from './CheckoutStepsManager';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Radio,
        LoadingButton,
        STErrorsDefault,
        BackButton
    },
    filters: {
        dateWithDay: (d: Date) => Formatter.capitalizeFirstLetter(Formatter.dateWithDay(d)),
        minutes: Formatter.minutes.bind(Formatter)
    }
})
export default class TimeSelectionView extends Mixins(NavigationMixin){
    step = -1

    loading = false
    errorBox: ErrorBox | null = null
    CheckoutManager = CheckoutManager

    get checkoutMethod() {
        return CheckoutManager.checkout.checkoutMethod!
    }

    get timeSlots(): WebshopTimeSlot[] {
        return CheckoutManager.checkout.checkoutMethod!.timeSlots.timeSlots.sort(WebshopTimeSlot.sort)
    }

    get selectedSlot(): WebshopTimeSlot {
        return CheckoutManager.checkout.timeSlot ?? this.timeSlots[0]
    }

    set selectedSlot(timeSlot: WebshopTimeSlot) {
        CheckoutManager.checkout.timeSlot = timeSlot
        CheckoutManager.saveCheckout()
    }

    get webshop() {
        return WebshopManager.webshop
    }

    async goNext() {
        if (this.loading || !this.selectedSlot) {
            return
        }
        // Force checkout save
        this.selectedSlot = this.selectedSlot as any
        this.loading = true
        this.errorBox = null

        try {
            const nextStep = await CheckoutStepsManager.getNextStep(CheckoutStepType.Time, true)
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
        HistoryManager.setUrl(WebshopManager.webshop.getUrlSuffix()+"/checkout/"+CheckoutStepType.Time.toLowerCase())
    }

    activated() {
        // For an unknown reason, we need to set a timer to properly update the URL...
        window.setTimeout(() => {
            HistoryManager.setUrl(WebshopManager.webshop.getUrlSuffix()+"/checkout/"+CheckoutStepType.Time.toLowerCase())
        }, 100);
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>