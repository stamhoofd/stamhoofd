<template>
    <form class="st-view bulk-seats-view shade" data-testid="bulk-seats-view" @submit.prevent="save">
        <STNavigationBar :title="product.name" />
        <main v-if="seatingPlan">
            <h1>
                {{ $t('Plaatsen voor {product}', { product: product.name }) }}
                <span class="title-suffix">
                    {{ selectedAmount }} / {{ amount }}
                </span>
            </h1>
            <p v-if="productInfo" class="style-description-block">
                {{ productInfo }}
            </p>

            <p class="inline-size style-description">
                <strong>{{ title }}</strong> {{ description }}
            </p>

            <STErrorsDefault :error-box="errorBox" />

            <div v-for="(seatingPlanSection, index) of seatingPlan.sections" :key="seatingPlanSection.id" class="container">
                <hr v-if="index > 0"><h2 v-if="seatingPlan.sections.length > 1 && seatingPlanSection.name">
                    {{ seatingPlanSection.name }}
                </h2>

                <SeatSelectionBox :seating-plan="seatingPlan" :seating-plan-section="seatingPlanSection" :seats="seats" :amount="amount" :reserved-seats="reservedSeats" :set-seats="setSeats" />
            </div>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="submit" :disabled="selectedAmount !== amount" data-testid="confirm-seats-button">
                        <span>{{ $t('%16p') }}</span>
                        <span class="icon arrow-right" />
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </form>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import LoadingButton from '@stamhoofd/components/navigation/LoadingButton.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import STToolbar from '@stamhoofd/components/navigation/STToolbar.vue';
import { useNavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import SeatSelectionBox from '@stamhoofd/components/views/SeatSelectionBox.vue';
import type { Product, ReservedSeat } from '@stamhoofd/structures';
import { CartReservedSeat } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';

import { useCheckoutManager } from '../../composables/useCheckoutManager';
import { useWebshopManager } from '../../composables/useWebshopManager';
import { CheckoutStepsManager } from './CheckoutStepsManager';

const props = defineProps<{
    product: Product;
}>();

const checkoutManager = useCheckoutManager();
const webshopManager = useWebshopManager();
const navigationActions = useNavigationActions();
const errorBox = ref<ErrorBox | null>(null);
const loading = ref(false);

const webshop = computed(() => webshopManager.webshop);
// Always read the live product: a reload replaces the webshop (and its reserved seats)
const product = computed(() => webshop.value.products.find(p => p.id === props.product.id) ?? props.product);
// Every bulk cart item is one unit, so one seat per item
const items = computed(() => checkoutManager.cart.items.filter(i => i.product.id === props.product.id));
const amount = computed(() => items.value.length);
const seats = ref<CartReservedSeat[]>(items.value.flatMap(i => i.seats));
const selectedAmount = computed(() => seats.value.length);
const remainingAmount = computed(() => amount.value - selectedAmount.value);
const seatingPlan = computed(() => webshop.value.meta.seatingPlans.find(p => p.id === product.value.seatingPlanId));

const title = computed(() => {
    if (remainingAmount.value === 0) {
        return $t(`%12X`) + '.';
    }

    if (remainingAmount.value === amount.value) {
        return $t('Kies {seats}.', { seats: Formatter.pluralText(remainingAmount.value, $t(`%12Y`), $t(`%UL`)) });
    }
    return $t('Kies nog {seats}.', { seats: Formatter.pluralText(remainingAmount.value, $t(`%12Y`), $t(`%UL`)) });
});

const description = computed(() => $t(`%12Z`) + ' ' + Formatter.pluralText(amount.value, $t(`%12Y`), $t(`%UL`)) + ' ' + $t(`%12a`));

// Date and location so the visitor knows which performance these seats are for
const productInfo = computed(() => {
    const parts: string[] = [];
    if (product.value.dateRange) {
        parts.push(Formatter.capitalizeFirstLetter(product.value.dateRange.toString()));
    }
    if (product.value.location) {
        parts.push(product.value.location.name);
    }
    return parts.join(' • ');
});

// Seats reserved by this order (when editing) stay selectable
const reservedSeats = computed(() => {
    const ownReserved = items.value.flatMap(i => i.reservedSeats);
    return product.value.reservedSeats.filter(r => !ownReserved.find(rr => rr.equals(r)));
});

function setSeats(newSeats: ReservedSeat[]) {
    seats.value = newSeats.map(s => CartReservedSeat.create(s));
}

async function save() {
    if (loading.value || !seatingPlan.value) {
        return;
    }

    if (seatingPlan.value.requireOptimalReservation) {
        const adjusted = seatingPlan.value.adjustSeatsForBetterFit(seats.value, reservedSeats.value);

        if (adjusted) {
            setSeats(adjusted);
            errorBox.value = new ErrorBox(new SimpleError({
                code: 'adjusted',
                message: $t(`%12b`),
            }));
            return;
        }
    }

    if (seats.value.length !== amount.value) {
        errorBox.value = new ErrorBox(new SimpleError({
            code: 'invalid_seats',
            message: 'Invalid seats',
            human: $t(`%sM`, { seats: Formatter.pluralText(amount.value - seats.value.length, $t(`%12Y`), $t(`%UL`)) }),
        }));
        return;
    }

    loading.value = true;
    errorBox.value = null;

    // Seat i belongs to item i
    for (const [index, item] of items.value.entries()) {
        const seat = seats.value[index];
        seat.calculatePrice(seatingPlan.value);
        item.seats = [seat];
    }
    checkoutManager.saveCart();

    try {
        await CheckoutStepsManager.for(checkoutManager).goNext(CheckoutStepsManager.seatsStepId(props.product), navigationActions);
    } catch (e) {
        console.error(e);
        errorBox.value = new ErrorBox(e);
    }
    loading.value = false;
}
</script>

<style lang="scss">
.sheet .bulk-seats-view, .popup .bulk-seats-view {
    width: max-content !important;
    min-width: min(100vw, var(--st-sheet-width, 400px));
    max-width: 100vw;
}
</style>
