<template>
    <div ref="el" class="date-selection-container input-icon-container right icon arrow-down-small gray">
        <div v-if="$isMobile" class="input selectable" :class="{placeholder: modelValue === null}" @click="openContextMenu(true)">
            <div>{{ dateText }}</div>
        </div>
        <div v-else class="input selectable" :class="{placeholder: modelValue === null}" @click="focusFirst()" @mousedown.prevent>
            <span v-if="modelValue === null" class="placeholder">{{ placeholder }}</span>
            <div @click.prevent @mouseup.prevent>
                <input ref="dayInput" v-model="dayText" inputmode="numeric" autocomplete="off" @change="updateDate" @focus.prevent="onFocus(0)" @blur="onBlur" @click.prevent @mouseup.prevent @mousedown.prevent="onFocus(0)" @input="onTyping();">
                <span>{{ dayText }}</span>
            </div>

            <span :class="{sep: true, hide: !hasFocus}">/</span>

            <div @click.prevent @mouseup.prevent>
                <input ref="monthInput" v-model="monthText" inputmode="numeric" autocomplete="off" @change="updateDate" @focus.prevent="onFocus(1)" @blur="onBlur" @click.prevent @mouseup.prevent @mousedown.prevent="onFocus(1)" @input="onTyping();">
                <span v-if="hasFocus">{{ monthText }}</span>
                <span v-else>{{ monthTextLong }}</span>
            </div>

            <span :class="{sep: true, hide: !hasFocus}">/</span>

            <div @click.prevent @mouseup.prevent>
                <input ref="yearInput" v-model="yearText" inputmode="numeric" autocomplete="off" @change="updateDate" @focus.prevent="onFocus(2)" @blur="onBlur" @click.prevent @mouseup.prevent @mousedown.prevent="onFocus(2)" @input="onTyping();">
                <span>{{ yearText }}</span>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { Formatter } from '@stamhoofd/utility';

import { DateTime } from 'luxon';
import { computed, onActivated, onBeforeMount, onDeactivated, onMounted, ref, useTemplateRef, watch } from 'vue';
import { useIsMobile } from '../hooks';
import DateSelectionView from '../overlays/DateSelectionView.vue';

const props = withDefaults(defineProps<{
    required?: boolean;
    placeholder?: string;
    min?: Date | null;
    max?: Date | null;
    time?: { hours: number; minutes: number; seconds: number } | null;
}>(), {
    required: true,
    placeholder: $t(`2ac677a6-f225-46b6-8fea-f6e0f10582ca`),
    min: null,
    max: null,
    time: null,
});

const modelValue = defineModel<Date | null>({ default: (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
})() });

const present = usePresent();
const isMobile = useIsMobile();

const el = useTemplateRef('el');
const dayInput = useTemplateRef('dayInput');
const monthInput = useTemplateRef('monthInput');
const yearInput = useTemplateRef('yearInput');

let hasFocus = false;
const hasFocusUnbounced = ref(false);

const dayText = ref('');
const monthText = ref('');
const yearText = ref('');

let displayedComponent: ComponentWithProperties | null = null;

const onKey = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.repeat) {
        return;
    }

    if (!hasFocus) {
        return;
    }

    const focusedInput = document.activeElement as HTMLInputElement;
    const index = numberInputs.value.indexOf(focusedInput);

    if (index === -1) {
        return;
    }

    const config = numberConfigs.value[index];

    const key = event.key || event.keyCode;

    if (key === 'ArrowLeft') {
        if (index > 0) {
            selectNext(index - 1);
        }
        else {
            blurAll();
        }
        event.preventDefault();
    }
    else if (key === 'ArrowRight') {
        selectNext(index + 1);
        event.preventDefault();
    }
    else if (key === 'ArrowUp' || key === 'PageUp') {
        const value = parseInt(config.getValue());
        if (!isNaN(value) && value < config.max) {
            config.setValue((value + 1).toString());
        }
        event.preventDefault();
    }
    else if (key === 'ArrowDown' || key === 'PageDown') {
        const value = parseInt(config.getValue());
        if (!isNaN(value) && value > config.min) {
            config.setValue((value - 1).toString());
        }
        event.preventDefault();
    }
};

const updateHasFocus = () => {
    if (el.value === null) {
        return;
    }
    let focus = !!el.value.contains(document.activeElement);

    if (displayedComponent) {
        const instance = displayedComponent.componentInstance();
        if (instance) {
            if (instance.$el && document.activeElement && instance.$el.contains(document.activeElement)) {
                focus = true;
            }
        }
    }

    if (isMobile) {
        focus = false;
    }

    if (focus) {
        hasFocus = true;
        hasFocusUnbounced.value = true;
    }
    else {
        hasFocus = false;
        setTimeout(() => {
            hasFocusUnbounced.value = hasFocus;
        }, 50);
    }
};

onMounted(() => {
    updateTextStrings();

    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', updateHasFocus);
    document.addEventListener('focusout', updateHasFocus);
    document.addEventListener('visibilitychange', updateHasFocus);

    // Sometimes focusin/focusout isn't called reliably
    document.addEventListener('click', updateHasFocus, { passive: true });
});

onActivated(() => {
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', updateHasFocus);
    document.addEventListener('focusout', updateHasFocus);
    document.addEventListener('visibilitychange', updateHasFocus);

    // Sometimes focusin/focusout isn't called reliably
    document.addEventListener('click', updateHasFocus, { passive: true });
});

onDeactivated(() => {
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('focusin', updateHasFocus);
    document.removeEventListener('focusout', updateHasFocus);
    document.removeEventListener('visibilitychange', updateHasFocus);
    document.removeEventListener('click', updateHasFocus);
});

onBeforeMount(() => {
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('focusin', updateHasFocus);
    document.removeEventListener('focusout', updateHasFocus);
    document.removeEventListener('visibilitychange', updateHasFocus);
    document.removeEventListener('click', updateHasFocus);
});

function updateTextStrings() {
    updateTextStringsHelper();

    if (modelValue.value && props.time) {
        if ((props.min && modelValue.value < props.min) || (props.max && modelValue.value > props.max) || modelValue.value.getHours() !== props.time.hours || modelValue.value.getMinutes() !== props.time.minutes || modelValue.value.getSeconds() !== props.time.seconds || modelValue.value.getMilliseconds() !== 0) {
            emitDate(modelValue.value);
        }
    }
}

function updateTextStringsHelper() {
    const currentDateValue = textDateTime.value ? new Date(textDateTime.value.toMillis()) : null;

    const iso1 = modelValue.value ? Formatter.dateIso(modelValue.value) : '';
    const iso2 = currentDateValue ? Formatter.dateIso(currentDateValue) : '';

    if (iso1 !== iso2 || !hasFocusUnbounced.value) {
        dayText.value = modelValue.value ? Formatter.day(modelValue.value) : '';
        monthText.value = modelValue.value ? Formatter.monthNumber(modelValue.value).toString() : '';
        yearText.value = modelValue.value ? Formatter.year(modelValue.value).toString() : '';
    }
}

const monthTextLong = computed(() => {
    return modelValue.value ? Formatter.month(modelValue.value) : '';
});

const numberInputs = computed(() => [dayInput.value, monthInput.value, yearInput.value]);

type NumberConfig = {
    maxLength: number;
    max: number;
    min: number;
    type: string;
    getValue: () => string;
    setValue: (value: string) => void;
};

const numberConfigs = computed<NumberConfig[]>(() => {
    return [
        {
            maxLength: 2,
            max: 31,
            min: 1,
            type: 'day',
            getValue: () => {
                return dayText.value;
            },
            setValue: (value: string) => {
                dayText.value = value;
                updateDate();
            },
        },
        {
            maxLength: 2,
            max: 12,
            min: 1,
            type: 'month',
            getValue: () => {
                return monthText.value;
            },
            setValue: (value: string) => {
                monthText.value = value;
                updateDate();
            },
        },
        {
            maxLength: 4,
            max: 2100,
            min: 1900,
            type: 'year',
            getValue: () => {
                return yearText.value;
            },
            setValue: (value: string) => {
                yearText.value = value;
                updateDate();
            },
        },
    ];
});

function blurAll() {
    // Blur all
    for (const element of numberInputs.value) {
        element?.blur();
    }
}

function selectNext(index: number) {
    if (index < 0) {
        return;
    }

    if (index >= numberInputs.value.length) {
        // Remove extra characters of last input
        const config = numberConfigs.value[index - 1];
        let val = config.getValue().replace(/[^0-9]/g, '');

        while (val.length >= 2) {
            const shorter = val.substring(0, val.length - 1);
            if (isFull(shorter, config)) {
                val = shorter;
            }
            else {
                break;
            }
        }

        config.setValue(val);

        // Blur all
        blurAll();

        return;
    }

    if (index >= 1) {
        const config = numberConfigs.value[index - 1];
        const val = config.getValue();

        // Get location of first special character after a number
        const firstSpecialCharacter = val.search(/[0-9][^0-9]/);
        const cutIndex = firstSpecialCharacter > -1 ? Math.min(firstSpecialCharacter + 1, config.maxLength, val.length) : Math.min(config.maxLength, val.length);

        if (val.length > cutIndex) {
            config.setValue(val.substr(0, cutIndex).replace(/[^0-9]/g, ''));

            const currentConfig = numberConfigs.value[index];

            const moveText = val.substr(cutIndex).replace(/^[^0-9]+/, '');
            currentConfig.setValue(moveText + currentConfig.getValue());

            if (isFull(currentConfig.getValue(), currentConfig)) {
                selectNext(index + 1);
                return;
            }
        }
        else {
            // Clean previous
            config.setValue(val.replace(/[^0-9]/g, ''));
        }
    }

    (numberInputs.value[index] as HTMLInputElement).focus();

    if ((numberInputs.value[index] as HTMLInputElement).value.length > 0) {
        // iOS fix
        (numberInputs.value[index] as HTMLInputElement).select();
    }
}

function onBlur() {
    // todo
}

function isFull(value: string, config: NumberConfig) {
    if (value.length >= config.maxLength) {
        return true;
    }

    // If any addition of a zero would go above maximum value
    const valueWithZero = parseInt(value + '0');
    if (valueWithZero > config.max) {
        return true;
    }

    return false;
}

function onTyping() {
    // Check if we can move to the next field
    const focusedInput = document.activeElement as HTMLInputElement;
    const index = numberInputs.value.indexOf(focusedInput);

    if (index !== -1) {
        // TODO remove and split on special characters
        // todo: automatically move extra characters to the next field

        // Check move to next date
        if (isFull(focusedInput.value, numberConfigs.value[index])) {
            selectNext(index + 1);
        }
    }
}

function focusFirst() {
    if (!hasFocus) {
        onFocus(0);
    }
}

function updateDate() {
    const date = textDateTime.value ? new Date(textDateTime.value.toMillis()) : null;

    if (date) {
        emitDate(date);
    }
}

const textDateTime = computed(() => {
    const day = parseInt(dayText.value.replace(/[^0-9]/g, ''));
    const month = parseInt(monthText.value.replace(/[^0-9]/g, ''));
    const year = parseInt(yearText.value.replace(/[^0-9]/g, ''));

    if (day && month && year && !isNaN(day) && !isNaN(month) && !isNaN(year)) {
        const correctedMonth = Math.min(month, 12);
        const luxonMonth = DateTime.fromObject({ year, month: correctedMonth }, { zone: Formatter.timezone });
        if (luxonMonth.isValid) {
            const result = DateTime.fromObject({ year, month: correctedMonth, day: Math.min(day, luxonMonth.daysInMonth) }, { zone: Formatter.timezone });
            if (result.isValid) {
                return result;
            }
        }
    }

    return null;
});

const dateText = computed(() => modelValue.value ? Formatter.date(modelValue.value, true) : props.placeholder);

function emitDate(value: Date | null): void {
    if (!value) {
        modelValue.value = null;
        return;
    }

    let d = DateTime.fromJSDate(value, { zone: Formatter.timezone });
    const max = props.max ? DateTime.fromJSDate(props.max, { zone: Formatter.timezone }) : null;
    const min = props.min ? DateTime.fromJSDate(props.min, { zone: Formatter.timezone }) : null;

    // First correct for min/max
    if (max && d > max) {
        d = max;
    }

    if (min && d < min) {
        d = min;
    }

    if (props.time) {
        d = d.set({ hour: props.time.hours, minute: props.time.minutes, second: props.time.seconds, millisecond: 0 });
    }
    else if (modelValue.value) {
        const modelValueLuxon = Formatter.luxon(modelValue.value);
        d = d.set({ hour: modelValueLuxon.hour, minute: modelValueLuxon.minute, second: 0, millisecond: 0 });
    }
    else {
        d = d.set({ hour: 12, minute: 0, second: 0, millisecond: 0 });
    }

    // End with min/max correction again
    if (max && d > max) {
        d = max;

        if (props.time) {
            // To fix infinite loop, we'll need to decrease the day with 1
            d = d.minus({ day: 1 });
            d = d.set({ hour: props.time.hours, minute: props.time.minutes, second: props.time.seconds, millisecond: 0 });
        }
    }

    if (min && d < min) {
        d = min;

        if (props.time) {
            // To fix infinite loop, we'll need to increase the day with 1
            d = d.plus({ day: 1 });
            d = d.set({ hour: props.time.hours, minute: props.time.minutes, second: props.time.seconds, millisecond: 0 });
        }
    }

    modelValue.value = d.toJSDate();
}

const selectedDay = computed(() => {
    return modelValue.value ? new Date(modelValue.value) : new Date();
});

function openContextMenu(autoDismiss = true) {
    if (displayedComponent || el.value === null) {
        return;
    }

    const newDisplayedComponent = new ComponentWithProperties(DateSelectionView, {
        x: el.value.getBoundingClientRect().left + el.value.offsetWidth,
        y: el.value.getBoundingClientRect().top + el.value.offsetHeight - 2,
        wrapHeight: el.value.offsetHeight - 4,
        xPlacement: 'left',
        autoDismiss,
        // preferredWidth: el.offsetWidth,
        selectedDay,
        allowClear: !props.required,
        min: props.min,
        max: props.max,
        setDate: (value: Date | null) => {
            emitDate(value);
        },
        onClose: () => {
            blurAll();
            displayedComponent = null;
        },
    });
    present(newDisplayedComponent.setDisplayStyle('overlay')).catch(console.error);
    displayedComponent = newDisplayedComponent;
}

async function hideDisplayedComponent({ unlessFocused } = { unlessFocused: false }) {
    if (displayedComponent) {
        const instance = displayedComponent.componentInstance();
        if (instance) {
            if (unlessFocused && instance.$el && document.activeElement && instance.$el.contains(document.activeElement)) {
                // Add an event listener to focus yearInput when blur
                const activeElement = document.activeElement;
                const listener = () => {
                    activeElement.removeEventListener('change', listener);
                    activeElement.removeEventListener('focusout', listener);
                    // selectNext(2)
                };
                activeElement.addEventListener('change', listener);
                activeElement.addEventListener('focusout', listener);

                // return;
            }
            await (instance as any).dismiss();
        }
        displayedComponent = null;
    }
}

function onFocus(index: number) {
    selectNext(index);
}

watch(modelValue, (newValue, oldValue) => {
    if (newValue?.getTime() !== oldValue?.getTime()) {
        updateTextStrings();
    }
});

watch(hasFocusUnbounced, (hasFocusUnbounced) => {
    if (!hasFocusUnbounced) {
        hideDisplayedComponent({ unlessFocused: true }).catch(console.error);
        // Clear invalid date text
        updateTextStrings();
    }
    else {
        openContextMenu(false);
    }
}, { immediate: true });
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.date-selection-container {
    .input.placeholder {
        color: $color-gray-5;
    }

    .input:focus-within > span.placeholder {
        display: none;
    }

    .input {
        padding: 5px 0;
        padding-right: 40px;
        padding-left: 10px;

        display: grid;
        grid-template-columns: auto auto auto auto auto;
        align-items: start;
        justify-content: start;

        > span.sep {
            color: $color-gray-5;
            pointer-events: none;
            width: 10px;
            transition: width 0.2s, opacity 0.2s;
            text-align: center;
            margin: 0 -5px;

            &.hide {
                display: none;
            }
        }

        > div {
            margin: -5px 0;
            padding: 5px;
            position: relative;
            overflow: hidden;
            text-overflow: ellipsis;
            height: 100%;

            > span {
                pointer-events: none;
            }

            > input {
                left: 0;
                top: 0;
                bottom: 0;
                right: 0;
                width: 100%;
                height: 100%;
                position: absolute;
                @extend .style-input;
                line-height: 1;
                box-sizing: border-box;
                opacity: 0;
                padding: 5px;
                padding-right: 0; // Fix being able to scroll inside the input
                overflow: hidden;
                caret-color: $color-primary;

                -webkit-user-select: none;
        -webkit-touch-callout: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        -webkit-user-modify: read-write-plaintext-only;
                user-modify: read-write-plaintext-only;

                &:focus {
                    opacity: 1;

                    + span {
                        opacity: 0;
                    }
                }
            }

            // Remove dotted line in Firefox
            > input:-moz-focusring {
                color: transparent;
                text-shadow: 0 0 0 #000;
            }
        }
    }
}
</style>
