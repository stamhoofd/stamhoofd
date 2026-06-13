<template>
    <div class="st-view show-seats-view shade">
        <STNavigationBar :disable-dismiss="!allowDismiss" :title="$t(`%kS`)" />
        <main>
            <h1>{{ $t('%kS') }}</h1>

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

            <hr><SeatSelectionBox v-if="seatingPlan && seatingPlanSection" :allow-changes="false" :seating-plan="seatingPlan" :seating-plan-section="seatingPlanSection" :seats="seats" :reserved-seats="reservedSeats" :highlight-seats="highlightSeats" />
        </main>
    </div>
</template>

<script lang="ts" setup>
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import type { Order, TicketPublic, Webshop } from '@stamhoofd/structures';
import { computed } from 'vue';

import SeatSelectionBox from './SeatSelectionBox.vue';

const props = withDefaults(defineProps<{
    ticket: TicketPublic;
    order?: Order | null;
    webshop: Webshop;
    allowDismiss?: boolean;
}>(), {
    order: null,
    allowDismiss: true,
});

const seatingPlan = computed(() => {
    const id = props.ticket.getSeatingPlanId();
    return props.webshop.meta.seatingPlans.find(p => p.id === id);
});

const seatingPlanSection = computed(() => {
    const plan = seatingPlan.value;
    if (!plan) {
        return null;
    }
    const seat = props.ticket.seat;
    if (!seat) {
        return plan.sections[0];
    }
    return plan.sections.find(s => s.id === seat.section) ?? null;
});

const seats = computed(() => {
    const seat = props.ticket.seat;
    if (!seat) {
        return [];
    }
    return [seat];
});

const seatDescription = computed(() => {
    const seat = props.ticket.seat;
    const product = props.ticket.items[0]?.product;
    if (!seat || !product) {
        return [];
    }
    return seat.getName(props.webshop, product);
});

const reservedSeats = computed(() => {
    const product = props.ticket.items[0]?.product;
    if (product) {
        const updatedProduct = props.webshop.products.find(p => p.id === product.id);
        if (updatedProduct) {
            return updatedProduct.reservedSeats;
        }
    }
    return [];
});

const highlightSeats = computed(() => {
    // Other seats from this order (if any)
    if (!props.order) {
        return [];
    }
    const product = props.ticket.items[0]?.product;
    if (!product) {
        return [];
    }
    return props.order.data.cart.items.filter(i => i.product.seatingPlanId === seatingPlan.value?.id && i.product.id === product.id).flatMap(i => i.seats);
});
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
