<template>
    <div class="container">
        <STInputBox error-fields="price" :error-box="errorBox" :title="$t(`c9b5231b-4f72-4afd-8be3-54a4b92bc3e4`)">
            <PriceInput v-model="price" :placeholder="$t(`74de7e46-000a-4f52-aa70-3365e88fec05`)"/>
        </STInputBox>

        <Checkbox v-model="useMinimumPrice">
            {{ $t('a025174f-13ab-4257-a35e-0ba1f3436472') }}
        </Checkbox>

        <div v-if="useMinimumPrice" class="split-inputs">
            <STInputBox error-fields="minimumPrice" :error-box="errorBox" :title="$t(`81e48b0e-a21c-445d-8fdb-aea0fdfc9b2f`)">
                <PriceInput v-model="minimumPrice" :placeholder="$t(`1076124d-b942-4020-b3c6-3ec6ba797b45`)"/>
            </STInputBox>

            <STInputBox error-fields="discountPrice" :error-box="errorBox" :title="$t(`3822753a-ff5b-43da-9e18-6603ef7d2d72`)">
                <PriceInput v-model="discountPrice" :placeholder="$t(`74de7e46-000a-4f52-aa70-3365e88fec05`)"/>
            </STInputBox>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { Checkbox, ErrorBox, PriceInput, STInputBox } from '@stamhoofd/components';
import { CheckoutMethodPrice } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = withDefaults(defineProps<{
    checkoutMethodPrice: CheckoutMethodPrice;
    errorBox: ErrorBox | null;
}>(), {
    errorBox: null,
});

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
