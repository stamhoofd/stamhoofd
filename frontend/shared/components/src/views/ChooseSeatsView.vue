<template>
    <form class="st-view choose-seats-view shade" data-testid="choose-seats-view" @submit.prevent="save">
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
                <hr v-if="index > 0"><h2 v-if="seatingPlan.sections.length > 1 && seatingPlanSection.name">
                    {{ seatingPlanSection.name }}
                </h2>

                <SeatSelectionBox :seating-plan="seatingPlan" :seating-plan-section="seatingPlanSection" :seats="cartItem.seats" :amount="cartItem.amount" :reserved-seats="reservedSeats" :highlight-seats="highlighedSeats" :set-seats="setSeats" :admin="admin" />
            </div>
        </main>

        <STToolbar>
            <template #right>
                <button class="button primary" type="submit" :disabled="selectedAmount !== amount" data-testid="confirm-seats-button">
                    <span>{{ $t('%X9') }}</span>
                    <span class="icon arrow-right" />
                </button>
            </template>
        </STToolbar>
    </form>
</template>

<script lang="ts" setup>
import { ErrorBox } from '#errors/ErrorBox.ts';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import STToolbar from '#navigation/STToolbar.vue';
import { SimpleError } from '@simonbackx/simple-errors';
import { useCanDismiss, useDismiss } from '@simonbackx/vue-app-navigation';
import type { Cart, CartItem, ReservedSeat, Webshop } from '@stamhoofd/structures';
import { CartReservedSeat } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';

import SeatSelectionBox from './SeatSelectionBox.vue';

const props = withDefaults(defineProps<{
    admin?: boolean;
    cartItem: CartItem;
    oldItem?: CartItem | null;
    webshop: Webshop;
    cart: Cart;
    saveHandler: (
        newItem: CartItem,
        oldItem: CartItem | null,
        component: { dismiss: ReturnType<typeof useDismiss>; canDismiss: boolean },
    ) => void;
}>(), {
    admin: false,
    oldItem: null,
});

const dismiss = useDismiss();
const canDismiss = useCanDismiss();
const errorBox = ref<ErrorBox | null>(null);
const amount = computed(() => props.cartItem.amount);
const selectedAmount = computed(() => props.cartItem.seats.length);
const remainingAmount = computed(() => amount.value - selectedAmount.value);
const seatingPlan = computed(() => props.webshop.meta.seatingPlans.find(p => p.id === props.cartItem.product.seatingPlanId));
const cartEnabled = computed(() => props.webshop.shouldEnableCart);

const title = computed(() => {
    if (remainingAmount.value === 0) {
        return $t(`%12X`);
    }

    if (remainingAmount.value === amount.value) {
        return `Kies ${Formatter.pluralText(remainingAmount.value, $t(`%12Y`), $t(`%UL`))}`;
    }
    return `Kies nog ${Formatter.pluralText(remainingAmount.value, $t(`%12Y`), $t(`%UL`))}`;
});

const description = computed(() => $t(`%12Z`) + ' ' + Formatter.pluralText(amount.value, $t(`%12Y`), $t(`%UL`)) + ' ' + $t(`%12a`));

function setSeats(seats: ReservedSeat[]) {
    props.cartItem.seats = seats.map(s => CartReservedSeat.create(s));
}

const reservedSeats = computed(() => {
    const planId = props.cartItem.product.seatingPlanId;
    return [
        ...props.cartItem.product.reservedSeats,
        ...props.cart.items.filter(i => i.product.seatingPlanId === planId && i.product.id === props.cartItem.product.id).flatMap(i => i.seats).filter(r => !props.oldItem?.seats.find(rr => rr.equals(r))),
    ].filter(r => !props.cartItem.reservedSeats.find(rr => rr.equals(r)));
});

const highlighedSeats = computed(() => {
    const planId = props.cartItem.product.seatingPlanId;
    return props.cart.items.filter(i => i.product.seatingPlanId === planId && i.product.id === props.cartItem.product.id).flatMap(i => i.seats).filter(r => !props.oldItem?.seats.find(rr => rr.equals(r)));
});

function validate() {
    try {
        const clonedCart = props.cart.clone();
        if (!cartEnabled.value) {
            clonedCart.clear();
        } else if (props.oldItem) {
            clonedCart.removeItem(props.oldItem);
        }
        props.cartItem.validate(props.webshop, clonedCart, {
            refresh: true,
            admin: props.admin,
            validateSeats: true,
        });
    } catch (e) {
        console.error(e);
        errorBox.value = new ErrorBox(e);
        return false;
    }
    errorBox.value = null;
    return true;
}

function save() {
    if (seatingPlan.value?.requireOptimalReservation && !props.admin) {
        const adjusted = seatingPlan.value.adjustSeatsForBetterFit(props.cartItem.seats, reservedSeats.value);

        if (adjusted) {
            setSeats(adjusted);
            errorBox.value = new ErrorBox(new SimpleError({
                code: 'adjusted',
                message: $t(`%12b`),
            }));
            return;
        }
    }

    if (!validate()) {
        return;
    }

    try {
        props.saveHandler(props.cartItem, props.oldItem, {
            dismiss,
            canDismiss: canDismiss.value,
        });
    } catch (e) {
        console.error(e);
        errorBox.value = new ErrorBox(e);
        return;
    }
    errorBox.value = null;
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
