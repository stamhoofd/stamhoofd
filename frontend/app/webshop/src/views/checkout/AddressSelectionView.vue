<template>
    <SaveView :loading="loading" save-icon-right="arrow-right" save-text="Doorgaan" data-submit-last-field @save="goNext" :title="$t(`Kies je leveringsadres`)">
        <h1>{{ $t('fc077f6b-dfae-448d-824e-46c3dc12d4d7') }}</h1>
        <div v-if="deliveryMethod && deliveryMethod.price.minimumPrice !== null && deliveryMethod.price.discountPrice !== checkout.deliveryPrice" class="info-box">
            {{ $t('8a0f7ea4-cfbd-4f1e-a79c-c68b5dab6d15') }} {{ formatPrice(deliveryMethod.price.minimumPrice) }} om van een verlaagde leveringskost van {{ formatPrice(deliveryMethod.price.discountPrice) }} {{ $t('9414fd6d-631e-443b-8a70-555f4a73b941') }}
        </div>

        <p v-if="checkout.deliveryPrice === 0" class="success-box">
            {{ $t('3681333c-99e7-41eb-ba61-183de6e2b3bf') }}
            <template v-if="deliveryMethod && deliveryMethod.price.minimumPrice !== null && deliveryMethod.price.price !== 0">
                {{ $t('e5f9ca0d-02be-4635-8dee-f29f42048011') }} {{ formatPrice(deliveryMethod.price.minimumPrice) }}.
            </template>
        </p>
        <p v-else class="info-box">
            {{ $t('5c037af2-8ec6-4f7d-9260-d493dc636a2d') }} {{ formatPrice(checkout.deliveryPrice) }}
            <template v-if="deliveryMethod && deliveryMethod.price.minimumPrice !== null && deliveryMethod.price.discountPrice === checkout.deliveryPrice">
                {{ $t('e5f9ca0d-02be-4635-8dee-f29f42048011') }} {{ formatPrice(deliveryMethod.price.minimumPrice) }}.
            </template>
        </p>

        <STErrorsDefault :error-box="errors.errorBox"/>

        <AddressInput v-model="address" :required="true" :validator="errors.validator" :validate-server="unscopedServer" :title="$t(`482b9f66-c75e-4ef5-a0dd-405bceccea66`)"/>
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
