<template>
    <form class="st-view choose-seats-view shade" @submit.prevent="save">
        <STNavigationBar title="Plaatsen" :pop="canPop" :dismiss="canDismiss" />
        <main>
            <h1>Kies je plaatsen</h1>
            <STErrorsDefault :error-box="errorBox" />

            <SeatSelectionBox 
                v-if="seatingPlan && seatingPlanSection"
                :seating-plan="seatingPlan"
                :seating-plan-section="seatingPlanSection"
                :seats="cartItem.seats"
                :amount="cartItem.amount"
                :reserved-seats="reservedSeats"
                :highlight-seats="highlighedSeats"
                :set-seats="setSeats"
            />
        </main>

        <STToolbar>
            <button v-if="oldItem && cartEnabled" slot="right" class="button primary" type="submit">
                <span class="icon basket" />
                <span>Opslaan</span>
            </button>
            <button v-else slot="right" class="button primary" type="submit">
                <span v-if="cartEnabled" class="icon basket" />
                <span v-if="cartEnabled">Toevoegen</span>
                <span v-else>Doorgaan</span>
                <span v-if="!cartEnabled" class="icon arrow-right" />
            </button>
        </STToolbar>
    </form>
</template>


<script lang="ts">
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { BackButton, ErrorBox, NumberInput, Radio, StepperInput, STErrorsDefault, STList, STListItem, STNavigationBar, STToolbar } from '@stamhoofd/components';
import { Cart, CartItem, ReservedSeat, Webshop } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from 'vue-property-decorator';

import FieldBox from './FieldBox.vue';
import OptionMenuBox from './OptionMenuBox.vue';
import SeatSelectionBox from './SeatSelectionBox.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Radio,
        NumberInput,
        OptionMenuBox,
        StepperInput,
        FieldBox,
        STErrorsDefault,
        BackButton,
        SeatSelectionBox
    },
    filters: {
        price: Formatter.price.bind(Formatter),
        priceChange: Formatter.priceChange.bind(Formatter),
        priceFree: (p: number) => {
            if (p === 0) {
                return "Gratis"
            }
            return Formatter.price(p);
        }
    }
})
export default class ChooseSeatsView extends Mixins(NavigationMixin){
    @Prop({ default: false })
        admin: boolean
        
    @Prop({ required: true })
        cartItem: CartItem

    @Prop({ default: null })
        oldItem: CartItem | null

    @Prop({ required: true })
        webshop: Webshop

    @Prop({ required: true })
        cart: Cart

    @Prop({ required: true })
        saveHandler: (newItem: CartItem, oldItem: CartItem | null, component) => void

    errorBox: ErrorBox | null = null

    
    get seatingPlanSection() {
        const plan = this.seatingPlan
        if (!plan) {
            return null
        }
        const seat = this.cartItem.seats[0]
        if (!seat) {
            return plan.sections[0]
        }
        return plan.sections.find(s => s.id === seat.sId) ?? null
    }

    setSeats(seats: ReservedSeat[]) {
        this.cartItem.seats = seats
    }

    get reservedSeats() {
        const planId = this.cartItem.product.seatingPlanId
        // All reserved seats, except the ones that are already reserved by this item
        return [
            ...this.cartItem.product.reservedSeats, 
            ...this.cart.items.filter(i => i.product.seatingPlanId === planId).flatMap(i => i.seats).filter(r => !this.oldItem?.seats.find(rr => rr.equals(r)))
        ].filter(r => !this.cartItem.reservedSeats.find(rr => rr.equals(r)))
    }

    get highlighedSeats() {
        const planId = this.cartItem.product.seatingPlanId
        return this.cart.items.filter(i => i.product.seatingPlanId === planId).flatMap(i => i.seats).filter(r => !this.oldItem?.seats.find(rr => rr.equals(r)))
    }

    get cartEnabled() {
        return this.webshop.shouldEnableCart
    }

    get seatingPlan() {
        return this.webshop.meta.seatingPlans.find(p => p.id === this.cartItem.product.seatingPlanId)
    }

    save() {
        try {
            this.saveHandler(this.cartItem, this.oldItem, this)
        } catch (e) {
            console.error(e);
            this.errorBox = new ErrorBox(e)
            return
        }
        this.errorBox = null // required if dismiss is disabled
        //this.dismiss({ force: true })
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.sheet .choose-seats-view {
    width: max-content !important;
    min-width: min(100vw, var(--st-sheet-width, 400px));
    max-width: 100vw;
}
</style>