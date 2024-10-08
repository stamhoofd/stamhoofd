<template>
    <SaveView :title="title" :loading="loading" save-icon-right="arrow-right" save-text="Doorgaan" :prefer-large-button="true" @save="goNext">
        <h1>
            {{ title }}
        </h1>

        <p v-if="checkoutMethod.type === 'Takeout'">
            Afhaallocatie: {{ checkoutMethod.name ? checkoutMethod.name + ',' : '' }} {{ checkoutMethod.address }}
        </p>

        <p v-if="checkoutMethod.type === 'OnSite'">
            Locatie: {{ checkoutMethod.name ? checkoutMethod.name + ',' : '' }} {{ checkoutMethod.address }}
        </p>
                
        <STErrorsDefault :error-box="errorBox" />

        <STList>
            <STListItem v-for="(slot, index) in timeSlots" :key="index" :selectable="true" element-name="label" class="right-stack left-center">
                <template #left>
                    <Radio v-model="selectedSlot" name="choose-time-slot" :value="slot" />
                </template>
                <h2 class="style-title-list">
                    {{ formatDateWithDay(slot.date) }}
                </h2> 
                <p class="style-description">
                    Tussen {{ formatMinutes(slot.startTime) }} - {{ formatMinutes(slot.endTime) }}
                </p>

                <template #right>
                    <span v-if="slot.listedRemainingStock === 0" class="style-tag error">Volzet</span>
                    <span v-else-if="slot.listedRemainingStock !== null" class="style-tag">Nog {{ slot.listedRemainingStock }} {{ slot.remainingPersons !== null ? (slot.listedRemainingStock === 1 ? "persoon" : "personen") : (slot.listedRemainingStock === 1 ? "plaats" : "plaatsen") }}</span>
                </template>
            </STListItem>
        </STList>
    </SaveView>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";
import { ErrorBox, Radio, SaveView, STErrorsDefault, STList, STListItem } from "@stamhoofd/components";
import { CheckoutMethodType, WebshopTimeSlot } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { CheckoutManager } from '../../classes/CheckoutManager';
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
        dateWithDay: (d: Date) => Formatter.capitalizeFirstLetter(Formatter.dateWithDay(d)),
        minutes: Formatter.minutes.bind(Formatter)
    }
})
export default class TimeSelectionView extends Mixins(NavigationMixin){
    step = -1

    loading = false
    errorBox: ErrorBox | null = null
    CheckoutManager = CheckoutManager

    get title() {
        if (this.checkoutMethod.type === CheckoutMethodType.Takeout) {
            return "Kies je afhaaltijdstip"
        }
        if (this.checkoutMethod.type === CheckoutMethodType.Delivery) {
            return "Kies je leveringstijdstip"
        }
        if (this.checkoutMethod.type === CheckoutMethodType.OnSite) {
            return "Kies wanneer je komt"
        }
        return "Kies je tijdstip"
    }

    get checkoutMethod() {
        return this.$checkoutManager.checkout.checkoutMethod!
    }

    get timeSlots(): WebshopTimeSlot[] {
        return this.$checkoutManager.checkout.checkoutMethod!.timeSlots.timeSlots.slice().sort(WebshopTimeSlot.sort)
    }

    get selectedSlot(): WebshopTimeSlot {
        if (this.$checkoutManager.checkout.timeSlot) {
            return this.timeSlots.find(t => t.id === this.$checkoutManager.checkout.timeSlot!.id) ?? this.timeSlots[0]
        }
        return this.timeSlots[0]
    }

    set selectedSlot(timeSlot: WebshopTimeSlot) {
        this.$checkoutManager.checkout.timeSlot = timeSlot
        this.$checkoutManager.saveCheckout()
    }

    get webshop() {
        return this.$webshopManager.webshop
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
            await CheckoutStepsManager.for(this.$checkoutManager).goNext(CheckoutStepType.Time, this)
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
    }

    mounted() {
        // Force minimum selection
        this.selectedSlot = this.selectedSlot as any
    }
}
</script>

