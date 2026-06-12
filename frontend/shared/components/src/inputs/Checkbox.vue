<template>
    <div>
        <label :class="{'checkbox': !onlyLine, 'checkbox-line': onlyLine, manual, 'with-text': hasDefaultSlot }" :data-testid="dataTestid" @click="handleClick">
            <input ref="checkbox" v-model="checkboxValue" type="checkbox" :disabled="disabled" :indeterminate.prop="indeterminate">
            <div>
                <div>
                    <svg width="10" height="9" viewBox="0 0 10 9" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                            d="M1 4L4 8L9 1"
                            stroke="white"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                    </svg>
                </div>
                <div><slot /></div>
            </div>
        </label>
    </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, useSlots, useTemplateRef } from 'vue';

const model = defineModel<boolean>({ default: false });

withDefaults(defineProps<{
    name?: string;
    onlyLine?: boolean;
    disabled?: boolean;
    // Set to true to only allow external changes
    manual?: boolean;
    indeterminate?: boolean;
    dataTestid?: string;
}>(), {
    name: '',
    onlyLine: false,
    disabled: false,
    manual: false,
    indeterminate: false,
    dataTestid: 'checkbox',
});

const slots = useSlots();
const checkbox = useTemplateRef<HTMLInputElement>('checkbox');

const hasDefaultSlot = computed(() => !!slots.default);

const checkboxValue = computed({
    get: () => model.value,
    set: (value: boolean) => {
        model.value = value;

        // Add support for a model that doesn't change
        nextTick(() => {
            if (model.value !== value) {
                if (checkbox.value) {
                    checkbox.value.checked = model.value;
                }
            }
        }).catch(console.error);
    },
});

function handleClick(e: MouseEvent) {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
        e.preventDefault(); // prevent text-selection behavior
    }
}
</script>

<style lang="scss">
    .checkbox.manual {
        pointer-events: none;
    }
</style>
