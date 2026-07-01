<template>
    <div class="code-input input" data-testid="code-input">
        <!--
                We use type = text because we need the raw string value for the mask logic.
                Name includes 'search' to disable Safari autocomplete, who tries to autocomplete an email in a code input?!
            -->
        <input
            ref="inputElement"
            v-model="text"
            v-format-input="inputFormatter"
            type="text"
            :inputmode="numbersOnly ? 'numeric' : undefined"
            :pattern="numbersOnly ? '[0-9]*' : undefined"
            autocomplete="one-time-code"
            spellcheck="false"
            name="one-time-code"
            @input="onInput"
        >
        <div aria-hidden="true">
            <span class="filled">{{ text }}</span>
            <span v-for="(key, index) of suffix" :key="index" class="suffix" :class="key == '-' ? 'separator' : ''">{{ key }}</span>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { Formatter } from '@stamhoofd/utility';
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue';

const model = defineModel<string>({ default: '' });

const props = withDefaults(defineProps<{
    codeLength?: number;
    spaceLength?: number;
    numbersOnly?: boolean;
}>(), {
    codeLength: 6,
    spaceLength: 6,
    numbersOnly: true,
});

const emit = defineEmits<{
    (e: 'complete'): void;
}>();

const inputElement = useTemplateRef<HTMLInputElement>('inputElement');

function clean(value: string): string {
    const cleaned = props.numbersOnly ? value.replace(/\D+/g, '') : value.toLocaleUpperCase().replace(/[^0-9A-Z]+/g, '');
    return cleaned.substring(0, props.codeLength);
}

const pattern = computed(() => {
    const spaceLength = Math.max(1, props.spaceLength);
    const parts: (string | { length: number })[] = [];
    for (let i = 0; i < props.codeLength; i += spaceLength) {
        if (i > 0) {
            parts.push(' ');
        }
        parts.push({ length: Math.min(spaceLength, props.codeLength - i) });
    }
    return parts;
});

function format(cleanedValue: string): string {
    return Formatter.injectPattern(cleanedValue, pattern.value);
}

const inputFormatter = computed(() => ({ cleaner: clean, formatter: format }));

const text = ref(format(clean(model.value)));
const mask = computed(() => format('_'.repeat(props.codeLength)));
const suffix = computed(() => mask.value.substring(text.value.length));

watch(model, (value) => {
    const cleaned = clean(value);
    if (cleaned === clean(text.value)) {
        return;
    }
    text.value = format(cleaned);
});

onMounted(() => {
    setTimeout(() => {
        inputElement.value?.focus();
    }, 300);
});

function onInput(event: Event) {
    // The format directive already reformatted the value, but the v-model listener order is not guaranteed: sync manually before deriving the model value
    text.value = (event.currentTarget as HTMLInputElement).value;
    updateModelValue();
}

function updateModelValue() {
    const cleaned = clean(text.value);
    if (cleaned === model.value) {
        return;
    }
    model.value = cleaned;

    if (cleaned.length === props.codeLength) {
        inputElement.value?.blur();
        emit('complete');
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.code-input {
    position: relative;
    display: inline-block;
    vertical-align: middle;
    //width: auto;
    height: $input-height;
    font-family: monospace;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.3em;

    // Clear any padding: the overlay div and input define their own
    padding: 0 !important;

    > input {
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        bottom: 0;
        opacity: 0;
        width: 100%;
        box-sizing: border-box;
        padding: 5px 15px;
        height: calc(#{$input-height} - 2 * #{$border-width});
        line-height: calc(#{$input-height} - 10px - 2 * #{$border-width});

        &:focus {
            opacity: 1;

            & + div > .filled {
                visibility: hidden;
            }
        }
    }

    > div {
        pointer-events: none;
        user-select: none;
        padding: 5px 15px;
        white-space: nowrap;
        white-space: preserve nowrap;
        display: flex;

        > .suffix {
            color: $color-gray-5;
            opacity: 0.4;
            display: block;

            &.separator {
                opacity: 1;
                transform: translateY(0);
            }
        }
    }
}
</style>
