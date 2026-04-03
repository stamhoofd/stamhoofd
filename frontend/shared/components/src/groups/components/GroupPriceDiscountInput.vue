<template>
    <div class="split-inputs">
        <PriceOrPercentageInputBox v-model="price" v-model:type="type" :title="title" :max="type === 'percentage' ? 10000 : null" :min="0" :validator="validator" :error-box="errorBox">
            <template #box-right>
                <slot name="right" />
            </template>
        </PriceOrPercentageInputBox>

        <template v-if="showReducedPrice">
            <PriceInputBox v-if="type === 'price'" v-model="reducedPrice" :title="financialSupportSettings.priceName" :validator="validator" :placeholder="formatPrice(price)" :required="false" :error-box="errorBox" />
            <PermyriadInputBox v-else-if="type === 'percentage'" v-model="reducedPrice" :title="financialSupportSettings.priceName" :placeholder="formatPercentage(price)" :required="false" :validator="validator" :error-box="errorBox" />
        </template>
    </div>
</template>

<script setup lang="ts">
import PriceOrPercentageInputBox from '#inputs/PriceOrPercentageInputBox.vue';
import type { Group, GroupPriceDiscount } from '@stamhoofd/structures';
import { GroupPriceDiscountType, ReduceablePrice } from '@stamhoofd/structures';
import { computed } from 'vue';
import type { ErrorBox } from '../../errors/ErrorBox';
import type { Validator } from '../../errors/Validator';
import PermyriadInputBox from '../../inputs/PermyriadInputBox.vue';
import PriceInputBox from '../../inputs/PriceInputBox.vue';
import { useFinancialSupportSettings } from '../hooks';

const props = withDefaults(
    defineProps<{
        title: string;

        /**
         * Helps to determine if reduced prices are enabled or not
         */
        group?: Group | null;
        validator: Validator | null;
        errorBox?: ErrorBox | null;
    }>(),
    {
        group: null,
        errorBox: null,
    },
);
const model = defineModel<GroupPriceDiscount>({ required: true });

const { enabled, financialSupportSettings } = useFinancialSupportSettings({
    group: computed(() => props.group),
});

const showReducedPrice = computed(() => enabled || reducedPrice.value !== null);

const price = computed({
    get: () => model.value.value.price,
    set: price => model.value = model.value.patch({ value: ReduceablePrice.patch({ price }) }),
});
const reducedPrice = computed({
    get: () => model.value.value.reducedPrice,
    set: reducedPrice => model.value = model.value.patch({ value: ReduceablePrice.patch({ reducedPrice }) }),
});

const type = computed({
    get: () => {
        switch (model.value.type) {
            case GroupPriceDiscountType.Percentage:
                return 'percentage';
            case GroupPriceDiscountType.Fixed:
                return 'price';
            default:
                return 'percentage';
        }
    },
    set: (type) => {
        switch (type) {
            case 'percentage':
                return model.value = model.value.patch({ type: GroupPriceDiscountType.Percentage });
            case 'price':
                return model.value = model.value.patch({ type: GroupPriceDiscountType.Fixed });
        }
    },
});
</script>
