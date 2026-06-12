<template>
    <div>
        <label class="radio" :class="{ 'with-text': hasDefaultSlot }" :for="id">
            <input :id="id" ref="radio" v-model="radioButtonValue" type="radio" :name="name" :value="value" :autocomplete="autocomplete" :disabled="disabled">
            <div>
                <div />
                <div><slot /></div>
            </div>
        </label>
    </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, useSlots, useTemplateRef } from 'vue';

const model = defineModel<any>();

const props = withDefaults(defineProps<{
    name?: string;
    autocomplete?: string;
    value?: any;
    id?: any;
    disabled?: boolean;
}>(), {
    name: '',
    autocomplete: '',
    value: '',
    id: undefined,
    disabled: false,
});

const slots = useSlots();
const radio = useTemplateRef<HTMLInputElement>('radio');

const hasDefaultSlot = computed(() => !!slots.default);

const radioButtonValue = computed({
    get: () => model.value,
    set: (value: any) => {
        model.value = value;

        // Add support for a model that doesn't change
        nextTick(() => {
            if (model.value !== value) {
                if (radio.value) {
                    radio.value.checked = (model.value === props.value);
                }
            }
        }).catch(console.error);
    },
});
</script>
