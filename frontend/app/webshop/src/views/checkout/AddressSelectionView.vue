<template>
    <SaveView :loading="loading" save-icon-right="arrow-right" :save-text="$t('Doorgaan')" data-submit-last-field :title="$t(`Kies je leveringsadres`)" @save="goNext">
        <h1>{{ $t('Kies je leveringsadres') }}</h1>
        <div v-if="deliveryMethod && deliveryMethod.price.minimumPrice !== null && deliveryMethod.price.discountPrice !== checkout.deliveryPrice" class="info-box">
            {{ $t('Bestel minimum {min} om van een verlaagde leveringskost van {price} te genieten.', {min: formatPrice(deliveryMethod.price.minimumPrice), price: formatPrice(deliveryMethod.price.discountPrice)}) }}
        </div>

        <p v-if="checkout.deliveryPrice === 0" class="success-box">
            {{ $t('Levering is gratis') }}
            <template v-if="deliveryMethod && deliveryMethod.price.minimumPrice !== null && deliveryMethod.price.price !== 0">
                {{ $t('vanaf een bestelbedrag van {min}.', {min: formatPrice(deliveryMethod.price.minimumPrice)}) }}
            </template>
        </p>
        <p v-else class="info-box">
            {{ $t('De leveringskost bedraagt') }} {{ formatPrice(checkout.deliveryPrice) }}
            <template v-if="deliveryMethod && deliveryMethod.price.minimumPrice !== null && deliveryMethod.price.discountPrice === checkout.deliveryPrice">
                {{ $t('vanaf een bestelbedrag van {min}.', {min: formatPrice(deliveryMethod.price.minimumPrice)}) }}
            </template>
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <AddressInput v-model="address" :required="true" :validator="errors.validator" :validate-server="unscopedServer" :title="$t(`Vul het leveringsadres in`)" />
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
