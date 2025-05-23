<template>
    <SaveView :loading="loading" save-icon-right="arrow-right" :save-text="$t('c72a9ab2-98a0-4176-ba9b-86fe009fa755')" :prefer-large-button="true" :title="$t(`b799ec1f-af00-45a9-a0bf-7d02418d18b8`)" @save="goNext">
        <h1>{{ $t('cd539f63-31c0-46f3-a0b5-a3826796a9d0') }}</h1>

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
                    {{ checkoutMethod.description || (checkoutMethod as any).address || "" }}
                </p>
                <p v-if="checkoutMethod.timeSlots.timeSlots.length === 1" class="style-description-small">
                    {{ capitalizeFirstLetter(formatDate(checkoutMethod.timeSlots.timeSlots[0].date)) }} tussen {{ formatMinutes(checkoutMethod.timeSlots.timeSlots[0].startTime) }} - {{ formatMinutes(checkoutMethod.timeSlots.timeSlots[0].endTime) }}
                </p>

                <template v-if="checkoutMethod.timeSlots.timeSlots.length === 1" #right>
                    <span v-if="checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock === 0" class="style-tag error">{{ $t('53575cae-ac22-4ac5-96d5-b67464992e4f') }}</span>
                    <span v-else-if="checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock !== null" class="style-tag">{{ $t('07f945bf-649b-4138-a91e-9306a9a96955') }} {{ checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock }} {{ checkoutMethod.timeSlots.timeSlots[0].remainingPersons !== null ? (checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock === 1 ? "persoon" : "personen") : (checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock === 1 ? "plaats" : "plaatsen") }}</span>
                </template>
            </STListItem>
        </STList>
    </SaveView>
</template>

<script lang="ts" setup>
import { ErrorBox, useErrors, useNavigationActions } from '@stamhoofd/components';
import { CheckoutMethod, CheckoutMethodType } from '@stamhoofd/structures';

import { computed, ref } from 'vue';
import { useCheckoutManager } from '../../composables/useCheckoutManager';
import { useWebshopManager } from '../../composables/useWebshopManager';
import { CheckoutStepsManager, CheckoutStepType } from './CheckoutStepsManager';

const loading = ref(false);
const errors = useErrors();

const navigationActions = useNavigationActions();
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
        await CheckoutStepsManager.for(checkoutManager).goNext(CheckoutStepType.Method, navigationActions);
    }
    catch (e) {
        console.error(e);
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}
</script>
