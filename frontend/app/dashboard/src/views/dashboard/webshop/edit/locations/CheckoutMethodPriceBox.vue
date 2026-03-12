<template>
    <div class="container">
        <STInputBox error-fields="price" :error-box="errorBox" :title="$t(`%Sn`)">
            <PriceInput v-model="price" :placeholder="$t(`%1Mn`)" />
        </STInputBox>

        <Checkbox v-model="useMinimumPrice">
            {{ $t('%Sm') }}
        </Checkbox>

        <div v-if="useMinimumPrice" class="split-inputs">
            <STInputBox error-fields="minimumPrice" :error-box="errorBox" :title="$t(`%So`)">
                <PriceInput v-model="minimumPrice" :placeholder="$t(`%Sp`)" />
            </STInputBox>

            <STInputBox error-fields="discountPrice" :error-box="errorBox" :title="$t(`%Sq`)">
                <PriceInput v-model="discountPrice" :placeholder="$t(`%1Mn`)" />
            </STInputBox>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import PriceInput from '@stamhoofd/components/inputs/PriceInput.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
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
