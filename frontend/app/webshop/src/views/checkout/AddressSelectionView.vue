<template>
    <SaveView :loading="loading" save-icon-right="arrow-right" :save-text="$t('%16p')" data-submit-last-field :title="$t(`%Xn`)" @save="goNext">
        <h1>{{ $t('%Xn') }}</h1>
        <div v-if="deliveryMethod && deliveryMethod.price.minimumPrice !== null && deliveryMethod.price.discountPrice !== checkout.deliveryPrice" class="info-box">
            {{ $t('%Ut', {min: formatPrice(deliveryMethod.price.minimumPrice), price: formatPrice(deliveryMethod.price.discountPrice)}) }}
        </div>

        <p v-if="checkout.deliveryPrice === 0" class="success-box">
            {{ $t('%Uu') }}
            <template v-if="deliveryMethod && deliveryMethod.price.minimumPrice !== null && deliveryMethod.price.price !== 0">
                {{ $t('%Uv', {min: formatPrice(deliveryMethod.price.minimumPrice)}) }}
            </template>
        </p>
        <p v-else class="info-box">
            {{ $t('%Xo') }} {{ formatPrice(checkout.deliveryPrice) }}
            <template v-if="deliveryMethod && deliveryMethod.price.minimumPrice !== null && deliveryMethod.price.discountPrice === checkout.deliveryPrice">
                {{ $t('%Uv', {min: formatPrice(deliveryMethod.price.minimumPrice)}) }}
            </template>
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <AddressInput v-model="address" :required="true" :validator="errors.validator" :validate-server="unscopedServer" :title="$t(`%V0`)" />
    </SaveView>
</template>

<script lang="ts" setup>
import AddressInput from '@stamhoofd/components/inputs/AddressInput.vue';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { useNavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import type { Address} from '@stamhoofd/structures';
import { ValidatedAddress } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

import { useCheckoutManager } from '../../composables/useCheckoutManager';
import { useWebshopManager } from '../../composables/useWebshopManager';
import { CheckoutStepsManager, CheckoutStepType } from './CheckoutStepsManager';

const loading = ref(false);
const errors = useErrors();
const checkoutManager = useCheckoutManager();
const webshopManager = useWebshopManager();
const deliveryMethod = computed(() => checkoutManager.checkout.deliveryMethod);
const checkout = computed(() => checkoutManager.checkout);
const navigationActions = useNavigationActions();
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
        await CheckoutStepsManager.for(checkoutManager).goNext(CheckoutStepType.Address, navigationActions);
    }
    catch (e) {
        console.error(e);
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}
</script>
