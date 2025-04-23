<template>
    <ReduceablePriceInput v-model="model" :title="priceTitle" :validator="validator" :error-box="errorBox">
        <template #end>
            <slot />
        </template>
    </ReduceablePriceInput>
</template>

<script setup lang="ts">
import { ErrorBox, ReduceablePriceInput, usePlatform, Validator } from '@stamhoofd/components';
import { ReduceablePrice } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    tagId: string;
    showPricePerDay: boolean;
    validator: Validator;
    errorBox?: ErrorBox | null;
}>();

const model = defineModel<ReduceablePrice>({ required: true });

const platform = usePlatform();
const tag = platform.value.config.tags.find(t => t.id === props.tagId);
const priceTitle = computed(() => format(props.showPricePerDay ? $t(`8e5dfe36-70c4-4011-916f-2b6f0e0b7648`) : $t(`52bff8d2-52af-4d3f-b092-96bcfa4c0d03`)));

function format(base: string) {
    if (!props.tagId) {
        return base;
    }
    return `${base} voor ${tag?.name ?? $t(`49e90fda-d262-4fe7-a2e2-d6b48abc8e2b`)}`;
}
</script>
