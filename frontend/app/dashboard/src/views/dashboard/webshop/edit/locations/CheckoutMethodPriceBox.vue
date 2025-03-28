<template>
    <div class="container">
        <STInputBox error-fields="price" title="Leveringskost" :error-box="errorBox">
            <PriceInput v-model="price" placeholder="Gratis" />
        </STInputBox>

        <Checkbox v-model="useMinimumPrice">
            Andere leveringskost vanaf bestelbedrag
        </Checkbox>

        <div v-if="useMinimumPrice" class="split-inputs">
            <STInputBox error-fields="minimumPrice" title="Vanaf bestelbedrag" :error-box="errorBox">
                <PriceInput v-model="minimumPrice" placeholder="€ 0" />
            </STInputBox>

            <STInputBox error-fields="discountPrice" title="Verminderde leveringskost" :error-box="errorBox">
                <PriceInput v-model="discountPrice" placeholder="Gratis" />
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
