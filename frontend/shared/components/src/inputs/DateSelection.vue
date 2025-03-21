<template>
    <div ref="el" class="date-selection-container input-icon-container right icon arrow-down-small gray">
        <div v-if="isMobile" class="input selectable" :class="{placeholder: model === null}" @click="openContextMenu(true)">
            <div>{{ dateText }}</div>
        </div>
        <div v-else class="input selectable" :class="{placeholder: model === null}" @click="focusFirst()" @mousedown.prevent>
            <span v-if="model === null" class="placeholder">{{ placeholder }}</span>
            <div @click.prevent @mouseup.prevent>
                <input ref="dayInput" v-model="dayText" inputmode="numeric" autocomplete="off" @focus.prevent="onFocus(0)" @blur="onBlur" @click.prevent @mouseup.prevent @mousedown.prevent="onFocus(0)">
                <span>{{ dayText }}</span>
            </div>

            <span :class="{sep: true, hide: !hasFocus}">/</span>

            <div @click.prevent @mouseup.prevent>
                <input ref="monthInput" v-model="monthText" inputmode="numeric" autocomplete="off" @focus.prevent="onFocus(1)" @blur="onBlur" @click.prevent @mouseup.prevent @mousedown.prevent="onFocus(1)">
                <span v-if="hasFocus">{{ monthText }}</span>
                <span v-else>{{ monthTextLong }}</span>
            </div>

            <span :class="{sep: true, hide: !hasFocus}">/</span>

            <div @click.prevent @mouseup.prevent>
                <input ref="yearInput" v-model="yearText" inputmode="numeric" autocomplete="off" @focus.prevent="onFocus(2)" @blur="onBlur" @click.prevent @mouseup.prevent @mousedown.prevent="onFocus(2)">
                <span>{{ yearText }}</span>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { Formatter } from '@stamhoofd/utility';
import { DateTime } from 'luxon';
import { computed, ComputedRef, onActivated, onBeforeMount, onDeactivated, onMounted, useTemplateRef, WritableComputedRef } from 'vue';
import { useIsMobile } from '../hooks';
import DateSelectionView from '../overlays/DateSelectionView.vue';

type DateInputType = 'day' | 'month' | 'year';

type InputConfig = {
    readonly type: DateInputType;
    readonly maxLength: number;
    readonly format: (value: Date | null) => string;
    readonly max: number;
    readonly autoCorrectIfOutOfRange?: boolean;
};

type NumberConfig = {
    readonly model: WritableComputedRef<string, string>;
} & InputConfig;

const model = defineModel<Date | null>({ default: null });

const props = withDefaults(defineProps<{
    required?: boolean;
    placeholder?: string;
    min?: Date;
    max?: Date;
    // local time!
    time?: { hours: number; minutes: number; seconds: number; millisecond?: number } | null;
}>(), {
    required: true,
    placeholder: $t(`2ac677a6-f225-46b6-8fea-f6e0f10582ca`),
    min: () => new Date(1900, 0, 1, 0, 0, 0, 0),
    max: () => new Date(2100, 0, 1, 0, 0, 0, 0),
    time: null,
});

const defaultLocalTime: ComputedRef<{ hour: number; minute: number; second: number; millisecond: number }> = computed(() => {
    if (props.time !== null) {
        return {
            hour: props.time.hours,
            minute: props.time.minutes,
            second: props.time.seconds,
            millisecond: props.time.millisecond ?? 0,
        };
    }

    return ({ hour: 12, minute: 0, second: 0, millisecond: 0 });
});

const present = usePresent();
const isMobile = useIsMobile();
const el = useTemplateRef('el');
const dayInput = useTemplateRef('dayInput');
const monthInput = useTemplateRef('monthInput');
const yearInput = useTemplateRef('yearInput');
const numberInputs = computed(() => [dayInput.value, monthInput.value, yearInput.value]);

let hasFocus = false;

const dateTime = computed({
    get: () => model.value ? setTime(Formatter.luxon(model.value)) : DateTime.fromObject(defaultLocalTime.value, { zone: Formatter.timezone }).setZone(Formatter.timezone),
    set: (value: DateTime) => {
        if (value.isValid) {
            emitDateTime(value);
        }
    },
});

const selectedDay = computed(() => dateTime.value.toJSDate());

const dateText = computed(() => model.value ? Formatter.date(model.value, true) : props.placeholder);

const dayConfig: InputConfig = {
    type: 'day',
    maxLength: 2,
    max: 31,
    format: value => value ? Formatter.day(value) : '',
    autoCorrectIfOutOfRange: true,
};

const dayText = dateInputFactory(dayConfig);

const monthConfig: InputConfig = {
    type: 'month',
    maxLength: 2,
    max: 12,
    format: value => value ? Formatter.monthNumber(value).toString() : '',
    autoCorrectIfOutOfRange: true,
};

const monthText = dateInputFactory(monthConfig);

const monthTextLong = computed(() => model.value ? Formatter.month(model.value) : '');

const yearConfig: InputConfig = {
    type: 'year',
    maxLength: 4,
    max: props.max.getFullYear(),
    format: value => value ? Formatter.year(value).toString() : '',
};

const yearText = dateInputFactory(yearConfig);

const numberConfigs: NumberConfig[] = [
    {
        ...dayConfig,
        model: dayText,
    },
    {
        ...monthConfig,
        model: monthText,
    },
    {
        ...yearConfig,
        model: yearText,
    },
];

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

    const config = numberConfigs[index];

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
        setText((parseInt(config.model.value) + 1).toString(), config, false);
        event.preventDefault();
    }
    else if (key === 'ArrowDown' || key === 'PageDown') {
        setText((parseInt(config.model.value) - 1).toString(), config, false);
        event.preventDefault();
    }
};

const updateHasFocus = () => {
    if (el.value === null) {
        return;
    }

    const initial = hasFocus;

    let focus = !!el.value.contains(document.activeElement);

    if (isMobile) {
        focus = false;
    }
    else if (displayedComponent) {
        const instance = displayedComponent.componentInstance();
        if (instance) {
            if (instance.$el && document.activeElement && instance.$el.contains(document.activeElement)) {
                focus = true;
            }
        }
    }

    if (focus) {
        hasFocus = true;

        // if changed
        if (hasFocus !== initial) {
            openContextMenu(false);
        }
    }
    else {
        hasFocus = false;

        // if changed
        if (hasFocus !== initial) {
            setTimeout(() => {
                if (hasFocus) {
                    openContextMenu(false);
                }
                else {
                    hideDisplayedComponent({ unlessFocused: true });
                }
            });
        }
    }
};

onMounted(addEventListeners);
onActivated(addEventListeners);
onDeactivated(removeEventListeners);
onBeforeMount(removeEventListeners);

function dateInputFactory(config: InputConfig) {
    return computed({
        get: () => config.format(model.value),
        set: value => setText(value, config, true, true),
    });
}

function isFull(value: string, config: InputConfig) {
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

function setText(value: string, config: InputConfig, autoSelectNext = false, limitInput = false) {
    const valueRaw = parseInt(value);
    if (isNaN(valueRaw)) {
        return;
    }

    let result = Math.abs(valueRaw);

    if (limitInput) {
        switch (config.type) {
            case 'day': {
                const daysInMonth = dateTime.value.daysInMonth;

                if (daysInMonth !== undefined && result > daysInMonth) {
                    result = daysInMonth;
                }
                break;
            }
            case 'month': {
                if (result > 12) {
                    result = 12;
                }
                break;
            }
        }
    }

    dateTime.value = dateTime.value.set({ [config.type]: result });

    if (autoSelectNext && isFull(result.toString(), config)) {
        let nextIndex = -1;

        switch (config.type) {
            case 'day': {
                nextIndex = 1;
                break;
            }
            case 'month': {
                nextIndex = 2;
                break;
            }
            case 'year': {
                nextIndex = 3;
                break;
            }
        }

        selectNext(nextIndex);
    }
}

function addEventListeners() {
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', updateHasFocus);
    document.addEventListener('focusout', updateHasFocus);
    document.addEventListener('visibilitychange', updateHasFocus);

    // Sometimes focusin/focusout isn't called reliably
    document.addEventListener('click', updateHasFocus, { passive: true });
}

function removeEventListeners() {
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('focusin', updateHasFocus);
    document.removeEventListener('focusout', updateHasFocus);
    document.removeEventListener('visibilitychange', updateHasFocus);
    document.removeEventListener('click', updateHasFocus);
}

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

    const nextInput = numberInputs.value[index];

    if (nextInput) {
        nextInput.focus();
        if (nextInput.value.length > 0) {
            // iOS fix
            nextInput.select();
        }
    }
    else {
        blurAll();
    }
}

function onBlur() {
    // todo
}

function focusFirst() {
    if (!hasFocus) {
        onFocus(0);
    }
}

function setTime(dateTime: DateTime) {
    return dateTime.set({ ...defaultLocalTime.value });
}

function emitDateTime(dateTime: DateTime | null): void {
    if (!dateTime) {
        if (props.required) {
            model.value = selectedDay.value;
            return;
        }
        model.value = null;
        return;
    }

    const max = DateTime.fromJSDate(props.max).setZone(Formatter.timezone);
    const min = DateTime.fromJSDate(props.min).setZone(Formatter.timezone);

    dateTime = setTime(dateTime);

    // End with min/max correction again
    if (dateTime > max) {
        if (isFull(dateTime.year.toString(), yearConfig)) {
            dateTime = max;
            dateTime = setTime(dateTime);

            if (dateTime > max) {
                // To fix infinite loop, we'll need to decrease the day with 1
                dateTime = dateTime.minus({ day: 1 });
                dateTime = setTime(dateTime);
            }
        }
        else {
            return;
        }
    }

    if (dateTime < min) {
        if (isFull(dateTime.year.toString(), yearConfig)) {
            dateTime = min;
            dateTime = setTime(dateTime);

            if (dateTime < min) {
                // To fix infinite loop, we'll need to increase the day with 1
                dateTime = dateTime.plus({ day: 1 });
                dateTime = setTime(dateTime);
            }
        }
        else {
            return;
        }
    }

    model.value = dateTime.toJSDate();
}

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
            emitDateTime(value ? Formatter.luxon(value) : null);
        },
        onClose: () => {
            blurAll();
            displayedComponent = null;
        },
    });
    present(newDisplayedComponent.setDisplayStyle('overlay')).catch(console.error);
    displayedComponent = newDisplayedComponent;
}

function hideDisplayedComponent({ unlessFocused } = { unlessFocused: false }) {
    if (displayedComponent) {
        const instance = displayedComponent.componentInstance();
        if (instance) {
            if (unlessFocused && instance.$el && document.activeElement && instance.$el.contains(document.activeElement)) {
                // Add an event listener to focus yearInput when blur
                const activeElement = document.activeElement;
                const listener = () => {
                    activeElement.removeEventListener('change', listener);
                    activeElement.removeEventListener('focusout', listener);
                };
                activeElement.addEventListener('change', listener);
                activeElement.addEventListener('focusout', listener);
            }
            (instance as any).dismiss();
        }
        displayedComponent = null;
    }
}

function onFocus(index: number) {
    selectNext(index);
}
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
