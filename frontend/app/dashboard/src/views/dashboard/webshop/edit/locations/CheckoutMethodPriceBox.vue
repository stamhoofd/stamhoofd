<template>
    <div class="container">
        <PriceInputBox v-model="price" error-fields="price" :error-box="errorBox" :title="$t(`%Sn`)" :validator="validator" :placeholder="$t(`%1Mn`)" />

        <Checkbox v-model="useMinimumPrice">
            {{ $t('%Sm') }}
        </Checkbox>

        <div v-if="useMinimumPrice" class="split-inputs">
            <PriceInputBox v-model="minimumPrice" error-fields="minimumPrice" :error-box="errorBox" :title="$t(`%So`)" :placeholder="$t(`%Sp`)" :validator="validator" />

            <PriceInputBox v-model="discountPrice" error-fields="discountPrice" :error-box="errorBox" :title="$t(`%Sq`)" :placeholder="$t(`%1Mn`)" :validator="validator" />
        </div>
    </div>
</template>

<script lang="ts" setup>
import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import type { Validator } from '@stamhoofd/components';
import type { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import PriceInputBox from '@stamhoofd/components/inputs/PriceInputBox.vue';
import { CheckoutMethodPrice } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    checkoutMethodPrice: CheckoutMethodPrice;
    validator: Validator | null,
    errorBox: ErrorBox | null;
}>();

const emits = defineEmits<{
    (e: 'patch', patch: AutoEncoderPatchType<CheckoutMethodPrice>): void;
}>();

const price = computed({
    get: () => props.checkoutMethodPrice.price,
    set: (price: number) => {
        emits('patch', CheckoutMethodPrice.patch({ price }));
    },
});

const useMinimumPrice = computed({
    get: () => props.checkoutMethodPrice.minimumPrice !== null,
    set: (useMinimumPrice: boolean) => {
        emits('patch', CheckoutMethodPrice.patch({ minimumPrice: useMinimumPrice ? minimumPrice.value : null }));
    },
});

const minimumPrice = computed({
    get: () => props.checkoutMethodPrice.minimumPrice ?? 0,
    set: (minimumPrice: number | null) => {
        emits('patch', CheckoutMethodPrice.patch({ minimumPrice }));
    },
});

const discountPrice = computed({
    get: () => props.checkoutMethodPrice.discountPrice,
    set: (discountPrice: number) => {
        emits('patch', CheckoutMethodPrice.patch({ discountPrice }));
    },
});
</script>
