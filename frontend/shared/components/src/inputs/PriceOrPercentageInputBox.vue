<template>
    <FloatInputBox v-if="type === 'percentage'" v-bind="props" v-model="model" :suffix="'%'" :fraction-digits="2" :round-fraction-digits="2">
        <template #input-right>
            <button class="button icon arrow-down-small" type="button" @click="toggleType" />
        </template>
        <template #box-right>
            <slot name="box-right" />
        </template>
    </FloatInputBox>
    <FloatInputBox v-else v-bind="props" v-model="model" :suffix="'euro'" :fraction-digits="4" :round-fraction-digits="2">
        <template #input-right>
            <button class="button icon arrow-down-small" type="button" @click="toggleType" />
        </template>
        <template #box-right>
            <slot name="box-right" />
        </template>
    </FloatInputBox>
</template>

<script lang="ts" setup>
import type { ErrorBox } from '../errors/ErrorBox';
import type { Validator } from '../errors/Validator';
import { ContextMenu, ContextMenuItem } from '../overlays/ContextMenu';
import FloatInputBox from './FloatInputBox.vue';

const props = withDefaults(defineProps<{
     title?: string;
    errorFields?: string;
    class?: string | null;
    validator: Validator | null;
    errorBox?: ErrorBox | null;
    min?: number | null;
    max?: number | null;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
}>(), {
    title: undefined,
    errorFields: 'number',
    class: null,
    errorBox: null,
    min: null,
    max: null,
    placeholder: '',
    disabled: false,
    required: true,
});

const model = defineModel<number | null>({default: null});

const type = defineModel<'percentage' | 'price'>('type', {
    required: true,
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
