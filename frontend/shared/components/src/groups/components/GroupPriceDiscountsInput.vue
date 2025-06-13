<template>
    <GroupPriceDiscountInput v-for="(discount, index) of model" :key="index" :model-value="discount" :title="getTitle(index)" @update:model-value="setDiscount(index, $event)">
        <template v-if="index === model.length - 1" #right>
            <button v-if="index > 0" class="button icon trash small" type="button" @click="deleteDiscount(index)" />
            <button class="button icon add small" type="button" @click="addDiscount" />
        </template>
    </GroupPriceDiscountInput>
</template>

<script setup lang="ts">
import { Group, GroupPriceDiscount } from '@stamhoofd/structures';
import { watch } from 'vue';
import GroupPriceDiscountInput from './GroupPriceDiscountInput.vue';

const props = withDefaults(
    defineProps<{

        /**
         * Helps to determine if reduced prices are enabled or not
         */
        group?: Group | null;
    }>(),
    {
        group: null,
    },
);
const model = defineModel<GroupPriceDiscount[]>({ required: true });

/**
 * Assert to always have at least one item in the array
 */
watch(model, (value) => {
    if (value.length === 0) {
        model.value = [GroupPriceDiscount.create({})];
    }
}, { immediate: true });

function addDiscount() {
    model.value = [...model.value, model.value[model.value.length - 1]?.clone() ?? GroupPriceDiscount.create({})];
}

function deleteDiscount(index: number) {
    if (model.value.length <= 1) {
        return;
    }
    const array = [...model.value];
    array.splice(index, 1);
    model.value = array;
}

function setDiscount(index: number, discount: GroupPriceDiscount) {
    model.value = model.value.map((d, i) => {
        if (i === index) {
            return discount;
        }
        return d;
    });
}

function getTitle(index: number) {
    if (index === model.value.length - 1) {
        return $t('69783c9e-0199-4e1b-be23-35625515167d', { index: index + 2 });
    }
    return $t('bfbdccd4-c432-4098-8980-a83ac6f6a76c', { index: index + 2 });
}

</script>
