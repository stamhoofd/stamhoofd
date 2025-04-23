<template>
    <div class="container">
        <STInputBox error-fields="price" :error-box="errorBox" :title="$t(`482bd766-39fa-4340-91b4-ae22a23d5fa5`)">
            <PriceInput v-model="price" :placeholder="$t(`99e41cea-bce3-4329-8b17-e3487c4534ac`)" />
        </STInputBox>

        <Checkbox v-model="useMinimumPrice">
            {{ $t('f618d49c-9be0-46ca-af12-37d8bb9430eb') }}
        </Checkbox>

        <div v-if="useMinimumPrice" class="split-inputs">
            <STInputBox error-fields="minimumPrice" :error-box="errorBox" :title="$t(`d567a7a8-bcb3-477b-b857-d954cc4dfce2`)">
                <PriceInput v-model="minimumPrice" :placeholder="$t(`4c9238ec-4895-4ada-89c9-a4e2560d2f10`)" />
            </STInputBox>

            <STInputBox error-fields="discountPrice" :error-box="errorBox" :title="$t(`e7f6f003-c131-4fc5-8060-2318e344e4f2`)">
                <PriceInput v-model="discountPrice" :placeholder="$t(`99e41cea-bce3-4329-8b17-e3487c4534ac`)" />
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
