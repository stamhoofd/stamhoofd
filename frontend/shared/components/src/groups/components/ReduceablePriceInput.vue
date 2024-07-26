<template>
    <div class="split-inputs">
        <STInputBox :title="title" error-fields="price" :error-box="errorBox">
            <PriceInput v-model="price" placeholder="Gratis" :min="min" />
        </STInputBox>

        <STInputBox v-if="enabled || reducedPrice !== null" :title="reducedPriceName" error-fields="price" :error-box="errorBox">
            <PriceInput v-model="reducedPrice" :placeholder="formatPrice(price)" :min="min" :required="false" />
        </STInputBox>
    </div>
</template>

<script setup lang="ts">
import { PriceInput } from '@stamhoofd/components';
import { ReduceablePrice } from '@stamhoofd/structures';
import { computed } from 'vue';
import { ErrorBox } from '../../errors/ErrorBox';
import { useFinancialSupportSettings } from '../hooks';

withDefaults(
    defineProps<{
        errorBox?: ErrorBox|null,
        min?: number|null,
        title?: string
    }>(),
    {
        errorBox: null,
        min: null,
        title: 'Prijs'
    }
);
const model = defineModel<ReduceablePrice>({ required: true })
const {enabled, priceName: reducedPriceName} = useFinancialSupportSettings()

const price = computed({
    get: () => model.value.price,
    set: (price) => model.value = model.value.patch({ price })
})
const reducedPrice = computed({
    get: () => model.value.reducedPrice,
    set: (reducedPrice) => model.value = model.value.patch({ reducedPrice })
})
</script>
