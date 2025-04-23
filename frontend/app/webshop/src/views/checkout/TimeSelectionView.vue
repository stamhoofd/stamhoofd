<template>
    <SaveView :title="title" :loading="loading" save-icon-right="arrow-right" :save-text="$t('c72a9ab2-98a0-4176-ba9b-86fe009fa755')" :prefer-large-button="true" @save="goNext">
        <h1>
            {{ title }}
        </h1>

        <p v-if="checkoutMethod.type === 'Takeout'">
            {{ $t('1c789f22-cc29-4951-849b-90abcbec9a3d') }} {{ checkoutMethod.name ? checkoutMethod.name + ',' : '' }} {{ (checkoutMethod as any).address }}
        </p>

        <p v-if="checkoutMethod.type === 'OnSite'">
            {{ $t('af4a5122-ce11-4553-b589-490d6d4960cc') }} {{ checkoutMethod.name ? checkoutMethod.name + ',' : '' }} {{ (checkoutMethod as any).address }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STList>
            <STListItem v-for="(slot, index) in timeSlots" :key="index" :selectable="true" element-name="label" class="right-stack left-center">
                <template #left>
                    <Radio v-model="selectedSlot" name="choose-time-slot" :value="slot" />
                </template>
                <h2 class="style-title-list">
                    {{ formatDateWithDay(slot.date) }}
                </h2>
                <p class="style-description">
                    {{ $t('ffea69c7-7eff-4018-afa2-d054438d04eb') }} {{ formatMinutes(slot.startTime) }} - {{ formatMinutes(slot.endTime) }}
                </p>

                <template #right>
                    <span v-if="slot.listedRemainingStock === 0" class="style-tag error">{{ $t('53575cae-ac22-4ac5-96d5-b67464992e4f') }}</span>
                    <span v-else-if="slot.listedRemainingStock !== null" class="style-tag">{{ $t('07f945bf-649b-4138-a91e-9306a9a96955') }} {{ slot.listedRemainingStock }} {{ slot.remainingPersons !== null ? (slot.listedRemainingStock === 1 ? "persoon" : "personen") : (slot.listedRemainingStock === 1 ? "plaats" : "plaatsen") }}</span>
                </template>
            </STListItem>
        </STList>
    </SaveView>
</template>

<script lang="ts" setup>
import { ErrorBox, Radio, SaveView, STErrorsDefault, STList, STListItem, useErrors } from '@stamhoofd/components';
import { CheckoutMethodType, WebshopTimeSlot } from '@stamhoofd/structures';
import { computed, onMounted, ref } from 'vue';

import { useDismiss, useNavigationController, useShow } from '@simonbackx/vue-app-navigation';
import { useCheckoutManager } from '../../composables/useCheckoutManager';
import { CheckoutStepsManager, CheckoutStepType } from './CheckoutStepsManager';

const loading = ref(false);
const errors = useErrors();
const checkoutManager = useCheckoutManager();
const dismiss = useDismiss();
const show = useShow();
const navigationController = useNavigationController();

const title = computed(() => {
    if (checkoutMethod.value.type === CheckoutMethodType.Takeout) {
        return 'Kies je afhaaltijdstip';
    }
    if (checkoutMethod.value.type === CheckoutMethodType.Delivery) {
        return 'Kies je leveringstijdstip';
    }
    if (checkoutMethod.value.type === CheckoutMethodType.OnSite) {
        return 'Kies wanneer je komt';
    }
    return 'Kies je tijdstip';
});

const checkoutMethod = computed(() => checkoutManager.checkout.checkoutMethod!);
const timeSlots = computed(() => checkoutManager.checkout.checkoutMethod!.timeSlots.timeSlots.slice().sort(WebshopTimeSlot.sort));
const selectedSlot = computed({
    get: () => {
        if (checkoutManager.checkout.timeSlot) {
            return timeSlots.value.find(t => t.id === checkoutManager.checkout.timeSlot!.id) ?? timeSlots.value[0];
        }
        return timeSlots.value[0];
    },
    set: (timeSlot: WebshopTimeSlot) => {
        checkoutManager.checkout.timeSlot = timeSlot;
        checkoutManager.saveCheckout();
    },
});

async function goNext() {
    if (loading.value || !selectedSlot.value) {
        return;
    }
    // Force checkout save
    selectedSlot.value = selectedSlot.value as any;
    loading.value = true;
    errors.errorBox = null;

    try {
        await CheckoutStepsManager.for(checkoutManager).goNext(CheckoutStepType.Time, {
            dismiss,
            show,
            navigationController: navigationController.value,
        });
    }
    catch (e) {
        console.error(e);
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}

onMounted(() => {
    // Force minimum selection
    selectedSlot.value = selectedSlot.value as any;
});
</script>
