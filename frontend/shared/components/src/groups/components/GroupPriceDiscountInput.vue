<template>
    <div class="split-inputs">
        <STInputBox :title="title">
            <PriceOrPercentageInput v-model="price" v-model:type="type" :max="type === 'percentage' ? 10000 : null" :min="0" />
            <template #right>
                <slot name="right" />
            </template>
        </STInputBox>

        <template v-if="showReducedPrice">
            <PriceInputBox v-if="type === 'price'" v-model="reducedPrice" :title="financialSupportSettings.priceName" :validator="validator" :placeholder="formatPrice(price)" :required="false" />
            <STInputBox v-else-if="type === 'percentage'" :title="financialSupportSettings.priceName">
                <PermyriadInput v-model="reducedPrice" :placeholder="formatPercentage(price)" :required="false" />
            </STInputBox>
        </template>
    </div>
</template>

<script setup lang="ts">
import PermyriadInput from '#inputs/PermyriadInput.vue';
import PriceOrPercentageInput from '#inputs/PriceOrPercentageInput.vue';
import type { Group, GroupPriceDiscount } from '@stamhoofd/structures';
import { GroupPriceDiscountType, ReduceablePrice } from '@stamhoofd/structures';
import { computed } from 'vue';
import type { Validator } from '../../errors/Validator';
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
