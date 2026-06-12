<template>
    <div class="code-input">
        <div :class="{small: codeLength > 6}" data-testId="code-input">
            <!-- Name incluses 'search' to disable safari autocomplete, who tries to autocomplete an email in a number input?! -->
            <template v-for="index in codeLength" :key="index">
                <input
                    ref="numberInput"
                    :inputmode="numbersOnly ? 'numeric' : undefined"
                    class="input"
                    :class="{small: codeLength > 6}"
                    autocomplete="one-time-code"
                    :name="'search-code_'+index"
                    @input="onInput(index - 1)"
                    @click="selectNext(index - 1)"
                    @keyup.delete="clearInput(index - 1)"
                    @keyup.left="selectNext(index - 2)"
                    @keyup.right="selectNext(index)"
                    @change="updateValue"
                >
                <span v-if="index%spaceLength === 0 && index !== codeLength" class="bump">-</span>
                <span v-if="index%(spaceLength*2) === 0 && index !== codeLength" class="break" />
            </template>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { onMounted, ref, watch } from 'vue';

const model = defineModel<string>({ default: '' });

const props = withDefaults(defineProps<{
    codeLength?: number;
    spaceLength?: number;
    numbersOnly?: boolean;
}>(), {
    codeLength: 6,
    spaceLength: 3,
    numbersOnly: true,
});

const emit = defineEmits<{
    (e: 'complete'): void;
}>();

const numberInput = ref<HTMLInputElement[]>([]);

function hasInputs() {
    return Array.isArray(numberInput.value) && numberInput.value.length > 0;
}

watch(model, (value, oldValue) => {
    if (value === oldValue) {
        return;
    }
    if (value === getInternalValue()) {
        return;
    }
    if (!hasInputs()) {
        return;
    }
    for (let index = 0; index < props.codeLength; index++) {
        const element = numberInput.value[index];

        if (index < value.length) {
            const letter = value[index];
            element.value = letter;
        }
        else {
            element.value = '';
        }
    }
});

onMounted(() => {
    setTimeout(() => {
        selectNext(0);
    }, 300);
});

function onInput(index: number) {
    if (!hasInputs()) {
        return;
    }

    const input = numberInput.value[index];
    input.value = props.numbersOnly ? input.value.replace(/\D/g, '') : input.value.toLocaleUpperCase().replace(/[^0-9A-Z]/g, '');
    if (input.value.length >= 1) {
        // Sometimes the input element might be delayed (on CI, so only focus the next if the current input is still focused)
        selectNext(index + 1, document.activeElement === input);
    }
}

function clearInput(index: number, select = true) {
    if (!hasInputs()) {
        return;
    }

    // Move everything one to the left
    const input = numberInput.value[index];
    if (input.value.length === 0 && index < props.codeLength - 1) {
        input.value = numberInput.value[index + 1].value;
        numberInput.value[index + 1].value = '';
        clearInput(index + 1, false);
    }

    if (select) {
        if (index > 0) {
            selectNext(index - 1);
        }
        else {
            // reselect
            selectNext(index);
        }
        updateValue();
    }
}

function selectNext(index: number, focus = true) {
    if (index < 0) {
        return;
    }

    if (!hasInputs()) {
        return;
    }

    console.log('select next ', index);
    if (index >= props.codeLength) {
        const prev = numberInput.value[index - 1];
        const val = prev.value;
        if (val.length > 1) {
            prev.value = val.substr(0, 1);
        }
        for (let i = 0; i < props.codeLength; i++) {
            const element = numberInput.value[i];
            element.blur();
        }
        updateValue();

        if (getInternalValue().length === props.codeLength) {
            emit('complete');
        }
        return;
    }
    if (index >= 1) {
        const prev = numberInput.value[index - 1];
        const val = prev.value;
        if (val.length > 1) {
            prev.value = val.substr(0, 1);
            numberInput.value[index].value = val.substr(1);
            selectNext(index + 1);
            return;
        }
    }
    if (!numberInput.value[index]) {
        console.warn('CodeInput: No input found for index', index);
        return;
    }

    if (focus) {
        numberInput.value[index].focus();

        if (numberInput.value[index].value.length > 0) {
            // iOS fix
            numberInput.value[index].select();
        }
    }
    updateValue();
}

function getInternalValue() {
    if (!hasInputs()) {
        return '';
    }

    let val = '';
    for (let index = 0; index < props.codeLength; index++) {
        const element = numberInput.value[index];
        const letter = element.value.substr(0, 1).toUpperCase();
        val += letter;
        if (letter.length === 0) {
            break;
        }
    }
    return val;
}

function updateValue() {
    model.value = getInternalValue();
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">
@use "@stamhoofd/scss/base/text-styles.scss" as *;
@use "@stamhoofd/scss/base/variables.scss" as *;

.code-input {
    -webkit-touch-callout: none !important;

    > div {
        display: inline-flex;
        flex-direction: row;

        .input {
            margin: 0 2px;
            max-width: 32px;
            padding-left: 0;
            padding-right: 0;
            text-align: center;
            font-size: 20px;
            caret-color: transparent;
            text-transform: uppercase;
            -webkit-touch-callout: none !important;
        }

        .bump {
            width: 15px;
            align-self: center;
            text-align: center;
            font-size: 20px;
            line-height: 1;
            font-weight: $font-weight-default;
            color: $color-gray-text;
        }

        &.small {
            flex-wrap: wrap;
            row-gap: 5px;

            @media (max-width: 600px) {
                .break {
                    width: auto;
                    flex-basis: 100%;
                    opacity: 0;
                    height: 0;
                }
            }
        }

    }
}

</style>
