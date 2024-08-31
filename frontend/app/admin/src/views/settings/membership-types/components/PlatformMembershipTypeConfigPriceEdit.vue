<template>
    <ReduceablePriceInput v-model="model" :title="$priceTitle" :validator="validator" :error-box="errorBox">
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
    tagId: string,
    showPricePerDay: boolean,
    validator: Validator
    errorBox?: ErrorBox | null
}>();

const emits = defineEmits<{(e: 'delete'): void}>();

const model = defineModel<ReduceablePrice>({ required: true })
// const {patched, hasChanges, addPatch, patch} = usePatch(props.reduceablePrice);

const $platform = usePlatform();
const tag = $platform.value.config.tags.find(t => t.id === props.tagId);
// const $reduceablePrice = ref(props.reduceablePrice);
const $priceTitle = computed(() => format(props.showPricePerDay ? 'Vaste prijs' : 'Prijs'));

function format(base: string) {
    if(props.tagId === 'default') return base;
    return `${base} voor ${tag?.name ?? 'Onbekend'}`
}
</script>
