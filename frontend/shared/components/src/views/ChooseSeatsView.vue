<template>
    <form class="st-view choose-seats-view shade" @submit.prevent="save">
        <STNavigationBar :title="title" />
        <main v-if="seatingPlan">
            <h1>
                {{ title }}
                <span v-if="amount" class="title-suffix">
                    {{ selectedAmount }} / {{ amount }}
                </span>
            </h1>
            <p class="inline-size style-description">
                {{ description }}
            </p>
            

            <STErrorsDefault :error-box="errorBox" />


            <div v-for="(seatingPlanSection, index) of seatingPlan.sections" :key="seatingPlanSection.id" class="container">
                <hr v-if="index > 0">
                <h2 v-if="seatingPlan.sections.length > 1 && seatingPlanSection.name">
                    {{ seatingPlanSection.name }}
                </h2>

                <SeatSelectionBox 
                    :seating-plan="seatingPlan"
                    :seating-plan-section="seatingPlanSection"
                    :seats="cartItem.seats"
                    :amount="cartItem.amount"
                    :reserved-seats="reservedSeats"
                    :highlight-seats="highlighedSeats"
                    :set-seats="setSeats"
                    :admin="admin"
                />
            </div>
        </main>

        <STToolbar>
            <template #right><button class="button primary" type="submit" :disabled="selectedAmount !== amount">
                <span>Bevestigen</span>
                <span class="icon arrow-right" />
            </button></template>
        </STToolbar>
    </form>
</template>


<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { BackButton, ErrorBox, NumberInput, Radio, StepperInput, STErrorsDefault, STList, STListItem, STNavigationBar, STToolbar } from '@stamhoofd/components';
import { Cart, CartItem, CartReservedSeat, ReservedSeat, Webshop } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';

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

    get amount() {
        return this.cartItem.amount
    }

    get selectedAmount() {
        return this.cartItem.seats.length
    }

    get remainingAmount() {
        return this.amount - this.selectedAmount
    }

    get title() {
        if (this.remainingAmount === 0) {
            return 'Bevestig je plaatsen'
        }

        if (this.remainingAmount === this.amount) {
            return `Kies ${Formatter.pluralText(this.remainingAmount, 'plaats', 'plaatsen')}`
        }

        return `Kies nog ${Formatter.pluralText(this.remainingAmount, 'plaats', 'plaatsen')}`
    }

    get description() {
        return 'Kies in totaal ' + Formatter.pluralText(this.amount, 'plaats', 'plaatsen') + ' door de plaatsen één voor één aan te klikken. Je kan een plaats deselecteren door er nog eens op te klikken.'
    }
    
    get seatingPlanSection() {
        const plan = this.seatingPlan
        if (!plan) {
            return null
        }
        const seat = this.cartItem.seats[0]
        if (!seat) {
            return plan.sections[0]
        }
        return plan.sections.find(s => s.id === seat.section) ?? null
    }

    setSeats(seats: ReservedSeat[]) {
        // todo: attach prices
        this.cartItem.seats = seats.map(s => CartReservedSeat.create(s))
    }

    get reservedSeats() {
        const planId = this.cartItem.product.seatingPlanId
        
        // All reserved seats, except the ones that are already reserved by this item
        return [
            ...this.cartItem.product.reservedSeats, 
            ...this.cart.items.filter(i => i.product.seatingPlanId === planId && i.product.id === this.cartItem.product.id).flatMap(i => i.seats).filter(r => !this.oldItem?.seats.find(rr => rr.equals(r)))
        ].filter(r => !this.cartItem.reservedSeats.find(rr => rr.equals(r)))
    }

    get highlighedSeats() {
        const planId = this.cartItem.product.seatingPlanId
        return this.cart.items.filter(i => i.product.seatingPlanId === planId && i.product.id === this.cartItem.product.id).flatMap(i => i.seats).filter(r => !this.oldItem?.seats.find(rr => rr.equals(r)))
    }

    get cartEnabled() {
        return this.webshop.shouldEnableCart
    }

    get seatingPlan() {
        return this.webshop.meta.seatingPlans.find(p => p.id === this.cartItem.product.seatingPlanId)
    }

    validate() {
        try {
            const clonedCart = this.cart.clone()
            
            if (!this.cartEnabled) {
                clonedCart.clear()
            } else if (this.oldItem) {
                clonedCart.removeItem(this.oldItem)
            }

            this.cartItem.validate(this.webshop, clonedCart, {
                refresh: true,
                admin: this.admin,
                validateSeats: true
            })
        } catch (e) {
            console.error(e);
            this.errorBox = new ErrorBox(e)
            return false
        }
        this.errorBox = null
        return true;
    }

    save() {
        // Check seats are optimal
        if (this.seatingPlan && this.seatingPlan.requireOptimalReservation && !this.admin) {
            const adjusted = this.seatingPlan?.adjustSeatsForBetterFit(this.cartItem.seats, this.reservedSeats)

            if (adjusted) {
                this.setSeats(adjusted)

                this.errorBox = new ErrorBox(new SimpleError({
                    code: 'adjusted',
                    message: 'We hebben jouw gekozen plaatsen aangepast zodat er minder enkele plaatsen overblijven. Klik opnieuw op "Bevestigen" om verder te gaan.'
                }))
                return;
            }
        }

        if (!this.validate()) {
            return;
        }

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