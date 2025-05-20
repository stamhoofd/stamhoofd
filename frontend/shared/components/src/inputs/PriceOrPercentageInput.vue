<template>
    <FloatInput v-bind="props" v-model="model" :suffix="suffix">
        <template #right>
            <button class="button icon arrow-down-small" type="button" @click="toggleType" />
        </template>
    </FloatInput>
</template>

<script lang="ts" setup>
import { ContextMenu, ContextMenuItem } from '../overlays/ContextMenu';
import FloatInput from './FloatInput.vue';
import { computed } from 'vue';

const props = withDefaults(defineProps<{
    min?: number | null;
    max?: number | null;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
}>(), {
    min: null,
    max: null,
    placeholder: '',
    disabled: false,
    required: true,
});

const model = defineModel<number | null>('modelValue', {
    required: true,
});

const type = defineModel<'percentage' | 'price'>('type', {
    required: true,
});

const suffix = computed(() => {
    switch (type.value) {
        case 'percentage':
            return '%';
        case 'price':
            return 'euro';
        default:
            return '';
    }
});

async function toggleType(event: MouseEvent) {
    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: 'Percentage',
                selected: type.value === 'percentage',
                action: () => {
                    type.value = 'percentage';
                },
            }),
            new ContextMenuItem({
                name: 'Vast bedrag',
                selected: type.value === 'price',
                action: () => {
                    type.value = 'price';
                },
            }),
        ],
    ]);

    await menu.show({
        button: event.currentTarget as HTMLButtonElement,
    });
}

</script>
