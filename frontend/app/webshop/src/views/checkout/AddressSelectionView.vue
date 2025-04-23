<template>
    <SaveView :loading="loading" save-icon-right="arrow-right" :save-text="$t('c72a9ab2-98a0-4176-ba9b-86fe009fa755')" data-submit-last-field :title="$t(`Kies je leveringsadres`)" @save="goNext">
        <h1>{{ $t('31d85181-8246-4f2e-9982-7be4aae474d1') }}</h1>
        <div v-if="deliveryMethod && deliveryMethod.price.minimumPrice !== null && deliveryMethod.price.discountPrice !== checkout.deliveryPrice" class="info-box">
            {{ $t('2c0ebaf5-1a92-4b6e-b1e6-e08a8679b0aa', {min: formatPrice(deliveryMethod.price.minimumPrice), price: formatPrice(deliveryMethod.price.discountPrice)}) }}
        </div>

        <p v-if="checkout.deliveryPrice === 0" class="success-box">
            {{ $t('0c35c92b-972b-45ac-86fd-96fa571e5124') }}
            <template v-if="deliveryMethod && deliveryMethod.price.minimumPrice !== null && deliveryMethod.price.price !== 0">
                {{ $t('189c2064-87f1-4159-85e5-01a568e16c9d', {min: formatPrice(deliveryMethod.price.minimumPrice)}) }}
            </template>
        </p>
        <p v-else class="info-box">
            {{ $t('57d44f0d-097d-4b76-809d-16dafc995f00') }} {{ formatPrice(checkout.deliveryPrice) }}
            <template v-if="deliveryMethod && deliveryMethod.price.minimumPrice !== null && deliveryMethod.price.discountPrice === checkout.deliveryPrice">
                {{ $t('189c2064-87f1-4159-85e5-01a568e16c9d', {min: formatPrice(deliveryMethod.price.minimumPrice)}) }}
            </template>
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <AddressInput v-model="address" :required="true" :validator="errors.validator" :validate-server="unscopedServer" :title="$t(`8f5f55a6-5cab-4928-a52f-2cbe34904ef0`)" />
    </SaveView>
</template>

<script lang="ts" setup>
import { AddressInput, ErrorBox, SaveView, STErrorsDefault, useErrors } from '@stamhoofd/components';
import { Address, ValidatedAddress } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

import { useDismiss, useNavigationController, useShow } from '@simonbackx/vue-app-navigation';
import { useCheckoutManager } from '../../composables/useCheckoutManager';
import { useWebshopManager } from '../../composables/useWebshopManager';
import { CheckoutStepsManager, CheckoutStepType } from './CheckoutStepsManager';

const loading = ref(false);
const errors = useErrors();
const dismiss = useDismiss();
const show = useShow();
const navigationController = useNavigationController();

const checkoutManager = useCheckoutManager();
const webshopManager = useWebshopManager();
const deliveryMethod = computed(() => checkoutManager.checkout.deliveryMethod);
const checkout = computed(() => checkoutManager.checkout);
const address = computed({
    get: () => checkoutManager.checkout.address,
    set: (address: ValidatedAddress | Address | null) => {
        if (address instanceof ValidatedAddress) {
            checkoutManager.checkout.address = address;
            checkoutManager.saveCheckout();
        }
    },
});

const unscopedServer = computed(() => webshopManager.unscopedServer);

async function goNext() {
    if (loading.value) {
        return;
    }
    loading.value = true;

    if (!await errors.validator.validate()) {
        loading.value = false;
        return;
    }
    errors.errorBox = null;

    try {
        await CheckoutStepsManager.for(checkoutManager).goNext(CheckoutStepType.Address, {
            dismiss,
            navigationController: navigationController.value,
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
