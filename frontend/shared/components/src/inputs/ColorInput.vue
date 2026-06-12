<template>
    <STInputBox :title="title" error-fields="*" :error-box="errorBox">
        <label for="color-input" class="input color-input-box" :class="{ hasColor: !!hasColor }">
            <input v-model="colorRaw" class="text-input" pattern="#[0-9A-Fa-f]{6}" type="text" :placeholder="placeholder" :autocomplete="autocomplete" @blur="validate(false, false)">
            <input id="color-input" v-model="pickerColor" pattern="#[0-9A-Fa-f]{6}" class="color-input" type="color">
            <span class="color" :style="{ backgroundColor: myColor }" :class="{empty: !myColor}" />
            <span v-if="!myColor" class="icon arrow-down-small" />
        </label>
    </STInputBox>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { computed, ref, watch } from 'vue';

import { ErrorBox } from '../errors/ErrorBox';
import { useValidation } from '../errors/useValidation';
import type { Validator } from '../errors/Validator';
import STInputBox from './STInputBox.vue';

const model = defineModel<string | null>({ default: null });

const props = withDefaults(defineProps<{
    title?: string;
    validator?: Validator | null;
    disallowed?: string[];
    required?: boolean;
    placeholder?: string;
    autocomplete?: string;
}>(), {
    title: '',
    validator: null,
    disallowed: () => [],
    required: true,
    placeholder: '',
    autocomplete: 'color',
});

const colorRaw = ref(model.value ?? '');
const hasColor = ref(model.value ?? '');
const errorBox = ref<ErrorBox | null>(null);

watch(model, (val) => {
    if (val === null) {
        return;
    }
    colorRaw.value = val;
});

const pickerColor = computed({
    get: () => {
        if (!hasColor.value) {
            // Hacky solution to make black colors work from emtpy -> black
            return '#000001';
        }
        return hasColor.value || '#000000';
    },
    set: (val: string) => {
        colorRaw.value = val || '#000000';
        validate(false, true);
    },
});

if (props.validator) {
    useValidation(props.validator, () => validate(true, false));
}

const myColor = computed(() => hasColor.value ?? 'black');

function validate(final = true, silent = false) {
    colorRaw.value = colorRaw.value.trim().toUpperCase();

    if (!props.required && colorRaw.value.length === 0) {
        if (!silent) {
            errorBox.value = null;
        }
        hasColor.value = '';

        if (model.value !== null) {
            model.value = null;
        }
        return true;
    }

    if (colorRaw.value.length === 6 && !colorRaw.value.startsWith('#')) {
        colorRaw.value = '#' + colorRaw.value;
    }

    const regex = /^#[0-9A-F]{6}$/;

    if (!regex.test(colorRaw.value)) {
        hasColor.value = '';

        if (!silent) {
            errorBox.value = new ErrorBox(new SimpleError({
                code: 'invalid_field',
                message: $t(`%yr`),
                field: 'color',
            }));
        }
        if (model.value !== null) {
            model.value = null;
        }
        return false;
    }

    if (props.disallowed.includes(colorRaw.value)) {
        hasColor.value = '';

        if (!silent) {
            errorBox.value = new ErrorBox(new SimpleError({
                code: 'invalid_field',
                message: $t(`%ys`),
                field: 'color',
            }));
        }

        if (model.value !== null) {
            model.value = null;
        }

        return false;
    }

    hasColor.value = colorRaw.value;

    if (colorRaw.value !== model.value) {
        model.value = colorRaw.value;
    }
    if (!silent) {
        errorBox.value = null;
    }
    return true;
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.color-input-box {
    position: relative;
    padding-top: 0 !important;
    padding-bottom: 0;
    padding-right: 40px;

    .text-input {
        width: 100%;
        padding: 5px 0;
        height:  calc(#{$input-height} - 2 * #{$border-width});
        line-height: calc(#{$input-height} - 10px - 2 * #{$border-width});
        box-sizing: border-box;

    }

    .color-input {
        appearance: none;
        opacity: 0;
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translate(0, -50%);
        width: 15px;
        height: 15px;
        border-radius: 3px;
    }

    > span.color {
        position: absolute;
        right: 10px;
        top: 50%;
        width: 15px;
        height: 15px;
        border-radius: 3px;
        box-sizing: border-box;
        transform: translate(0, -50%);
    }

    > span.icon {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translate(0, -50%);
    }
}
</style>
