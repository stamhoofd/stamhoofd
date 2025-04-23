<template>
    <SaveView :loading="loading" save-icon-right="arrow-right" :save-text="$t('Doorgaan')" :prefer-large-button="true" :title="$t(`Kies je afhaalmethode`)" @save="goNext">
        <h1>{{ $t('Kies je afhaalmethode') }}</h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STList>
            <STListItem v-for="checkoutMethod in checkoutMethods" :key="checkoutMethod.id" :selectable="true" element-name="label" class="right-stack left-center">
                <template #left>
                    <Radio v-model="selectedMethod" name="choose-checkout-method" :value="checkoutMethod" />
                </template>
                <h2 class="style-title-list">
                    {{ getTypeName(checkoutMethod.type) }}: {{ checkoutMethod.name }}
                </h2>
                <p class="style-description-small">
                    {{ checkoutMethod.description || checkoutMethod.address || "" }}
                </p>
                <p v-if="checkoutMethod.timeSlots.timeSlots.length === 1" class="style-description-small">
                    {{ capitalizeFirstLetter(formatDate(checkoutMethod.timeSlots.timeSlots[0].date)) }} tussen {{ formatMinutes(checkoutMethod.timeSlots.timeSlots[0].startTime) }} - {{ formatMinutes(checkoutMethod.timeSlots.timeSlots[0].endTime) }}
                </p>

                <template v-if="checkoutMethod.timeSlots.timeSlots.length === 1" #right>
                    <span v-if="checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock === 0" class="style-tag error">{{ $t('Volzet') }}</span>
                    <span v-else-if="checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock !== null" class="style-tag">{{ $t('Nog') }} {{ checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock }} {{ checkoutMethod.timeSlots.timeSlots[0].remainingPersons !== null ? (checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock === 1 ? "persoon" : "personen") : (checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock === 1 ? "plaats" : "plaatsen") }}</span>
                </template>
            </STListItem>
        </STList>
    </SaveView>
</template>

<script lang="ts" setup>
import { ErrorBox, useErrors } from '@stamhoofd/components';
import { CheckoutMethod, CheckoutMethodType } from '@stamhoofd/structures';

import { useDismiss, useNavigationController, useShow } from '@simonbackx/vue-app-navigation';
import { computed, ref } from 'vue';
import { useCheckoutManager } from '../../composables/useCheckoutManager';
import { useWebshopManager } from '../../composables/useWebshopManager';
import { CheckoutStepsManager, CheckoutStepType } from './CheckoutStepsManager';

const loading = ref(false);
const errors = useErrors();

const navigationController = useNavigationController();
const dismiss = useDismiss();
const show = useShow();

const webshopManager = useWebshopManager();
const checkoutManager = useCheckoutManager();
const webshop = computed(() => webshopManager.webshop);
const checkoutMethods = computed(() => webshop.value.meta.checkoutMethods);
const selectedMethod = computed({
    get: () => {
        if (checkoutManager.checkout.checkoutMethod) {
            const search = checkoutManager.checkout.checkoutMethod.id;
            const f = webshop.value.meta.checkoutMethods.find(c => c.id === search);
            if (f) {
                return f;
            }
        }
        return webshop.value.meta.checkoutMethods[0];
    },
    set: (method: CheckoutMethod) => {
        checkoutManager.checkout.checkoutMethod = method;
        checkoutManager.saveCheckout();
    },
},
);

function getTypeName(type: CheckoutMethodType) {
    switch (type) {
        case CheckoutMethodType.Takeout: return 'Afhalen';
        case CheckoutMethodType.Delivery: return 'Levering';
        case CheckoutMethodType.OnSite: return 'Ter plaatse consumeren';
    }
}

async function goNext() {
    if (loading.value || !selectedMethod.value) {
        return;
    }
    // Force checkout save
    selectedMethod.value = selectedMethod.value as any;

    loading.value = true;
    errors.errorBox = null;

    try {
        await CheckoutStepsManager.for(checkoutManager).goNext(CheckoutStepType.Method, {
            navigationController: navigationController.value,
            dismiss,
            show,
        });
    }
    catch (e) {
        console.error(e);
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}
</script>
