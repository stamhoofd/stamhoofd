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
const priceTitle = computed(() => format(props.showPricePerDay ? 'Vaste prijs' : 'Prijs'));

function format(base: string) {
    if (!props.tagId) {
        return base;
    }
    return `${base} voor ${tag?.name ?? 'Onbekend'}`;
}
</script>
