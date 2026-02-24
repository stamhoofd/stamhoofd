<template>
    <div ref="el" class="date-selection-container input-icon-container right icon arrow-down-small gray">
        <div v-if="isMobile" class="input selectable" :class="{placeholder: model === null}" @click="openContextMenu(true)">
            <div data-testid="mobile-text">
                {{ dateText }}
            </div>
        </div>
        <div v-else class="input selectable" :class="{placeholder: model === null }" @click="focusFirst()" @mousedown.prevent>
            <span class="placeholder">{{ placeholderDate ? Formatter.date(placeholderDate, true) : placeholder }}</span>
            <div @click.prevent @mouseup.prevent>
                <input ref="dayInput" v-model="dayText" inputmode="numeric" autocomplete="off" :placeholder="dayPlaceholder" @focus.prevent="onFocus(0)" @blur="onBlur" @click.prevent @mouseup.prevent @mousedown.prevent="onFocus(0)" @input="onTyping">
                <span>{{ dayText || dayPlaceholder }}</span>
            </div>

            <span :class="{sep: true, hide: !hasFocus}">/</span>

            <div @click.prevent @mouseup.prevent>
                <input ref="monthInput" v-model="monthText" inputmode="numeric" :placeholder="monthPlaceholder" autocomplete="off" @focus.prevent="onFocus(1)" @blur="onBlur" @click.prevent @mouseup.prevent @mousedown.prevent="onFocus(1)" @input="onTyping">
                <span v-if="hasFocus">{{ monthText || monthPlaceholder }}</span>
                <span v-else>{{ monthTextLong || monthPlaceholder }}</span>
            </div>

            <span :class="{sep: true, hide: !hasFocus}">/</span>

            <div @click.prevent @mouseup.prevent>
                <input ref="yearInput" v-model="yearText" :placeholder="yearPlaceholder" inputmode="numeric" autocomplete="off" @focus.prevent="onFocus(2)" @blur="onBlur" @click.prevent @mouseup.prevent @mousedown.prevent="onFocus(2)" @input="onTyping">
                <span>{{ yearText || yearPlaceholder }}</span>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { Formatter } from '@stamhoofd/utility';
import { DateTime } from 'luxon';
import { computed, ComputedRef, nextTick, onActivated, onBeforeMount, onDeactivated, onMounted, Ref, ref, useTemplateRef, watch } from 'vue';
import { useIsMobile } from '../hooks';
import DateSelectionView from '../overlays/DateSelectionView.vue';

type DateInputType = 'day' | 'month' | 'year';

const dayPlaceholder = $t(`f0bd2c38-5490-4e28-a336-65c998cf3276`);
const monthPlaceholder = $t(`2727f83e-20ba-436e-8449-1e6f3e15c628`);
const yearPlaceholder = $t(`4e99ee6d-2445-4d3a-ab0f-343236295366`);

type InputConfig = {
    readonly type: DateInputType;
    readonly maxLength: number;
    readonly format: (value: Date | null) => string;
    readonly max: number;
    readonly min: number;
};

type NumberConfig = {
    readonly model: Ref<string, string>;
} & InputConfig;

const model = defineModel<Date | null>({ default: null });

const props = withDefaults(defineProps<{
    required?: boolean;
    placeholder?: string;
    placeholderDate?: Date | null;
    min?: Date;
    max?: Date;
    // local time!
    time?: { hours: number; minutes?: number; seconds?: number; millisecond?: number } | null;

    /**
     * Prevent changing the time (hour, minute, second, ms) if the initial date is selected / resellected.
     * Can be used in combination with time to force the time to a specific value only if changed.
     */
    adjustInitialTime?: boolean;
}>(), {
    required: true,
    placeholder: () => $t(`2ac677a6-f225-46b6-8fea-f6e0f10582ca`),
    placeholderDate: null,
    min: () => new Date(1900, 0, 1, 0, 0, 0, 0),
    max: () => new Date(2100, 0, 1, 0, 0, 0, 0),
    time: null,
    adjustInitialTime: true,
});

const defaultLocalTime: ComputedRef<{ hour: number; minute: number; second: number; millisecond: number }> = computed(() => {
    if (props.time !== null) {
        return {
            hour: props.time.hours,
            minute: props.time.minutes ?? 0,
            second: props.time.seconds ?? 0,
            millisecond: props.time.millisecond ?? 0,
        };
    }

    if (model.value) {
        const dateTime = Formatter.luxon(model.value);
        return {
            hour: dateTime.hour,
            minute: dateTime.minute,
            second: (dateTime.minute === 59) ? 59 : 0, // If it's 23:59, we set seconds to 59 to avoid issues with the next day
            millisecond: (dateTime.minute === 59) ? 999 : 0, // If it's 23:59, we set milliseconds to 999 to avoid issues with the next day
        };
    }

    return ({ hour: 12, minute: 0, second: 0, millisecond: 0 });
});

const present = usePresent();
const isMobile = useIsMobile();
const el = useTemplateRef<HTMLDivElement>('el');
const dayInput = useTemplateRef<HTMLInputElement>('dayInput');
const monthInput = useTemplateRef<HTMLInputElement>('monthInput');
const yearInput = useTemplateRef<HTMLInputElement>('yearInput');
const numberInputs = computed(() => [dayInput.value, monthInput.value, yearInput.value]);

const hasFocus = ref(false);

const selectedDay = computed(() => {
    let d = DateTime.fromObject(defaultLocalTime.value, { zone: Formatter.timezone }).setZone(Formatter.timezone);
    if (model.value) {
        d = setTime(Formatter.luxon(model.value));
    }
    else if (props.placeholderDate) {
        d = setTime(Formatter.luxon(props.placeholderDate));
    }
    d = limitDateTime(d) ?? d;
    return d.toJSDate();
});

const dateText = computed(() => model.value ? Formatter.date(model.value, true) : (props.placeholderDate ? Formatter.date(props.placeholderDate, true) : props.placeholder));

const dayConfig: InputConfig = {
    type: 'day',
    maxLength: 2,
    max: 31,
    min: 1,
    format: value => value ? Formatter.day(value) : '',
};

const { inputRef: dayText, onModelChange: onModelChangeDay } = dateInputFactory(dayConfig);

const monthConfig: InputConfig = {
    type: 'month',
    maxLength: 2,
    max: 12,
    min: 1,
    format: value => value ? Formatter.monthNumber(value).toString() : '',
};

const { inputRef: monthText, onModelChange: onModelChangeMonth } = dateInputFactory(monthConfig);

const monthTextLong = computed(() => model.value ? Formatter.month(model.value) : '');

const yearConfig: InputConfig = {
    type: 'year',
    maxLength: 4,
    min: props.min.getFullYear(),
    max: props.max.getFullYear(),
    format: value => value ? Formatter.year(value).toString() : '',
};

const { inputRef: yearText, onModelChange: onModelChangeYear } = dateInputFactory(yearConfig);

/**
 * Convert the text in the inputs to a DateTime object.
 */
function getTextInputDate() {
    let day = parseInt(dayText.value.replace(/[^0-9]/g, ''));
    let month = parseInt(monthText.value.replace(/[^0-9]/g, ''));
    let year = parseInt(yearText.value.replace(/[^0-9]/g, ''));

    if (day < dayConfig.min) {
        day = dayConfig.min;
    }
    if (day > dayConfig.max) {
        day = dayConfig.max;
    }
    if (month < monthConfig.min) {
        month = monthConfig.min;
    }
    if (month > monthConfig.max) {
        month = monthConfig.max;
    }
    if (year < yearConfig.min) {
        year = yearConfig.min;
    }
    if (year > yearConfig.max) {
        year = yearConfig.max;
    }

    if (!isNaN(day)) {
        dayText.value = day.toString();
    }
    if (!isNaN(month)) {
        monthText.value = month.toString();
    }
    if (!isNaN(year)) {
        yearText.value = year.toString();
    }

    if (day && month && year && !isNaN(day) && !isNaN(month) && !isNaN(year)) {
        const base = DateTime.fromObject(defaultLocalTime.value, { zone: Formatter.timezone }).setZone(Formatter.timezone);
        const date = base.set({
            day: day,
            month: month,
            year: year,
        });

        if (date.year === year && date.month === month && date.day === day) {
            return date;
        }

        // Check if first of month is valid
        if (day !== 1) {
            const firstOfMonth = base.set({ day: 1, month: month, year: year });
            if (firstOfMonth.year === year && firstOfMonth.month === month) {
                // Limit day to the last day of the month
                if (firstOfMonth.daysInMonth && day > firstOfMonth.daysInMonth) {
                    day = firstOfMonth.daysInMonth;
                    dayText.value = day.toString();

                    // Recalculate date
                    return getTextInputDate();
                }
            }
        }
    }
    return null;
}

watch(model, (value: Date | null) => {
    onModelChangeDay(value);
    onModelChangeMonth(value);
    onModelChangeYear(value);
});

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

    if (!hasFocus.value) {
        return;
    }

    const focusedInput = document.activeElement as HTMLInputElement;
    const index = numberInputs.value.indexOf(focusedInput);

    if (index === -1) {
        return;
    }

    const config = numberConfigs[index];

    const key = event.key || event.keyCode;

    if (key === 'Backspace' && config.model.value.length === 0) {
        if (index > 0) {
            selectNext(index - 1);
        }
        else {
            blurAllIfValid();
        }
        event.preventDefault();
    }
    else if (key === 'ArrowLeft') {
        if (index > 0) {
            selectNext(index - 1);
        }
        else {
            blurAllIfValid();
        }
        event.preventDefault();
    }
    else if (key === 'ArrowRight') {
        selectNext(index + 1);
        event.preventDefault();
    }
    else if (key === 'ArrowUp' || key === 'PageUp') {
        const value = parseInt(config.model.value);
        if (!isNaN(value) && value < config.max) {
            config.model.value = ((value + 1).toString());
        }
        event.preventDefault();
    }
    else if (key === 'ArrowDown' || key === 'PageDown') {
        const value = parseInt(config.model.value);
        if (!isNaN(value) && value > config.min) {
            config.model.value = ((value - 1).toString());
        }

        event.preventDefault();
    }
};

const updateHasFocus = async () => {
    await nextTick();
    if (el.value === null) {
        return;
    }

    const initial = hasFocus.value;

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
        hasFocus.value = true;

        // if changed
        if (hasFocus.value !== initial) {
            openContextMenu(false);
        }
    }
    else {
        hasFocus.value = false;
        updateText();

        // if changed
        if (hasFocus.value !== initial) {
            setTimeout(() => {
                if (hasFocus.value) {
                    // Changed
                    return;
                }
                hideDisplayedComponent({ unlessFocused: true });

                // Revert text inputs back to the actual stored value
                onModelChangeDay(model.value);
                onModelChangeMonth(model.value);
                onModelChangeYear(model.value);
            }, 50);
        }
    }
};

onMounted(addEventListeners);
onActivated(addEventListeners);
onDeactivated(removeEventListeners);
onBeforeMount(removeEventListeners);

function dateInputFactory(config: InputConfig) {
    const inputRef = ref(config.format(model.value));

    return {
        inputRef,
        onModelChange: (value: Date | null) => {
            inputRef.value = config.format(value);
        },
    };
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

/**
 * Update the model from the text input values
 */
function updateText() {
    const date = getTextInputDate();

    if (date && date.isValid) {
        emitDateTime(date);
    }
}

function onTyping() {
    // Check if we can move to the next field
    const focusedInput = document.activeElement as HTMLInputElement;
    const index = numberInputs.value.indexOf(focusedInput);

    if (index !== -1) {
        // Check move to next date
        if (isFull(focusedInput.value, numberConfigs[index])) {
            selectNext(index + 1);
        }
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

function blurAllIfValid() {
    if (dayText.value.length === 0 && monthText.value.length === 0 && yearText.value.length === 0) {
        blurAll();
        return;
    }

    const d = getTextInputDate();
    if (d && d.isValid) {
        blurAll();
    }
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
        blurAllIfValid();
    }
}

function onBlur() {
    // todo
}

function focusFirst() {
    if (!hasFocus.value) {
        onFocus(0);
    }
}

function setTime(dateTime: DateTime) {
    return dateTime.set({ ...defaultLocalTime.value });
}
const initialDate = model.value;

function emitDateTime(dateTime: DateTime | null): void {
    function emit(date: Date | null) {
        // only update if changed
        if (date?.getTime() !== model.value?.getTime()) {
            if (date && !props.adjustInitialTime && initialDate && Formatter.dateIso(initialDate) === Formatter.dateIso(date)) {
                // Force same time as initial time, to the ms
                const dateTime = Formatter.luxon(date);
                const initialDateTime = Formatter.luxon(initialDate);
                date = dateTime.set({
                    hour: initialDateTime.hour,
                    minute: initialDateTime.minute,
                    second: initialDateTime.second,
                    millisecond: initialDateTime.millisecond,
                }).toJSDate();
            }
            model.value = date;
        }
    }

    if (!dateTime) {
        if (props.required) {
            emit(selectedDay.value);
            return;
        }
        emit(null);
        return;
    }

    dateTime = limitDateTime(dateTime);
    if (dateTime === null) {
        // If the date is not valid, we don't set the model
        return;
    }

    emit(dateTime.toJSDate());
}

function limitDateTime(dateTime: DateTime): DateTime | null {
    const original = dateTime;
    const max = DateTime.fromJSDate(props.max).setZone(Formatter.timezone);
    const min = DateTime.fromJSDate(props.min).setZone(Formatter.timezone);

    dateTime = setTime(dateTime);

    if (dateTime > max) {
        if (isFull(dateTime.year.toString(), yearConfig)) {
            dateTime = max;

            if (props.time !== null) {
                dateTime = setTime(dateTime);

                if (dateTime > max) {
                // To fix infinite loop, we'll need to decrease the day with 1
                    dateTime = dateTime.minus({ day: 1 });
                    dateTime = setTime(dateTime);
                }
            }
        }
        else {
            return null;
        }
    }

    if (dateTime < min) {
        if (isFull(dateTime.year.toString(), yearConfig)) {
            dateTime = min;

            if (props.time !== null) {
                dateTime = setTime(dateTime);

                if (dateTime < min) {
                // To fix infinite loop, we'll need to increase the day with 1
                    dateTime = dateTime.plus({ day: 1 });
                    dateTime = setTime(dateTime);
                }
            }
        }
        else {
            return null;
        }
    }

    if (dateTime > max) {
        console.warn('Impossible to set time between min and max date');
        // check if datetime is closer to min or max
        const dayWithTime = setTime(original > max ? max : min);
        if (dayWithTime > max) {
            // set to max if closer to max
            dateTime = max;
        }
        else {
            // set to min if closer to min
            dateTime = min;
        }
    }

    return dateTime;
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
        time: props.time,
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

    // By default hide placeholder
    .input > span.placeholder {
        display: none;
    }

    // When has placeholder class and not focused, show placeholder
    .input.placeholder:not(:focus-within) {
        > span.placeholder {
            display: block;

            & ~ * {
                opacity: 0;
                pointer-events: none;
            }
        }
    }

    .input {
        padding: 5px 0;
        padding-right: 40px;
        padding-left: 15px;

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

        >.placeholder + div {
            margin-left: -5px;
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
