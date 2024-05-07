<template>
    <div class="st-view show-seats-view shade">
        <STNavigationBar title="Jouw plaatsen" :disableDismiss="!allowDismiss" />
        <main>
            <h1>Jouw plaatsen</h1>

            <STList>
                <STListItem v-if="seatDescription.length">
                    <div class="split-info">
                        <div v-for="(row, index) in seatDescription" :key="index">
                            <h3 class="style-definition-label">
                                {{ row.title }}
                            </h3>
                            <p class="style-definition-text">
                                {{ row.value }}
                            </p>
                        </div>
                    </div>
                </STListItem>
            </STList>

            <hr>

            <SeatSelectionBox 
                v-if="seatingPlan && seatingPlanSection"
                :allow-changes="false"
                :seating-plan="seatingPlan"
                :seating-plan-section="seatingPlanSection"
                :seats="seats"
                :reserved-seats="reservedSeats"
                :highlight-seats="highlightSeats"
            />
        </main>
    </div>
</template>


<script lang="ts">
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { STErrorsDefault, STList, STListItem, STNavigationBar, STToolbar } from '@stamhoofd/components';
import { Order, TicketPublic, Webshop } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';

import SeatSelectionBox from './SeatSelectionBox.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STErrorsDefault,
        SeatSelectionBox,
        STListItem,
        STList
    }
})
export default class ShowSeatsView extends Mixins(NavigationMixin){
    @Prop({ required: true })
        ticket: TicketPublic

    @Prop({ required: false, default: null })
        order: Order | null

    @Prop({ required: true })
        webshop: Webshop

    @Prop({ default: true })
        allowDismiss: boolean

    get seatingPlanSection() {
        const plan = this.seatingPlan
        if (!plan) {
            return null
        }
        const seat = this.ticket.seat
        if (!seat) {
            return plan.sections[0]
        }
        return plan.sections.find(s => s.id === seat.section) ?? null
    }

    get seatingPlan() {
        const id = this.ticket.getSeatingPlanId()
        return this.webshop.meta.seatingPlans.find(p => p.id === id)
    }

    get seats() {
        const seat = this.ticket.seat
        if (!seat) {
            return []
        }
        return [seat]
    }

    get seatDescription() {
        const seat = this.ticket.seat
        const product =  this.ticket.items[0]?.product
        if (!seat || !product) {
            return []
        }
        return seat.getName(this.webshop, product)
    }

    get reservedSeats() {
        const product = this.ticket.items[0]?.product
        if (product) {
            const updatedProduct = this.webshop.products.find(p => p.id === product.id)
            if (updatedProduct) {
                return updatedProduct.reservedSeats
            }
        }
        return []
    }

    get highlightSeats() {
        // Other seats from this order (if any)
        if (!this.order) {
            return []
        }
        const product = this.ticket.items[0]?.product
        if (!product) {
            return []
        }
        return this.order.data.cart.items.filter(i => i.product.seatingPlanId === this.seatingPlan?.id && i.product.id === product.id).flatMap(i => i.seats)
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.sheet .show-seats-view {
    width: max-content !important;
    min-width: min(100vw, var(--st-sheet-width, 400px));
    max-width: 100vw;
}

.show-seats-view {
    --st-vertical-padding: 0px;
}
</style>