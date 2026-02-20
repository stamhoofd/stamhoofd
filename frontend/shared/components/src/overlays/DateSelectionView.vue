<template>
    <ContextMenuView v-bind="$attrs" :auto-dismiss="autoDismiss">
        <aside ref="aside" class="date-selection-view">
            <header>
                <button type="button" class="button icon gray arrow-left" :disabled="isPreviousMonthDisabled" @click="previousMonth" />
                <h1>
                    <div class="input-icon-container right icon arrow-down-small gray">
                        <select v-model="month" data-testid="select-month" @mousedown.stop>
                            <option v-for="monthNumber in 12" :key="monthNumber" :value="monthNumber" :disabled="isMonthDisabled(luxonSelectedDay.year, monthNumber)">
                                {{ monthText(monthNumber) }}
                            </option>
                        </select>
                    </div>

                    <div class="input-icon-container right icon arrow-down-small gray">
                        <!-- key is added here because the select should be recreated when the offset changes, otherwise we get DOM issues and it looks like the wrong value is selected -->
                        <select :key="nowYear" v-model="currentYear" data-testid="select-year" @mousedown.stop>
                            <option v-for="year in 105" :key="nowYear - year + 5" :value="nowYear - year + 5" :disabled="isYearDisabled(nowYear - year + 5)">
                                {{ nowYear - year + 5 }}
                            </option>
                        </select>
                    </div>
                </h1>
                <button type="button" class="button icon gray arrow-right" :disabled="isNextMonthDisabled" @click="nextMonth" />
            </header>
            <div class="days">
                <div class="days">
                    <div>{{ $t('fe26fc19-8954-4fc4-827b-00b18feeea11') }}</div>
                    <div>{{ $t('277eb883-dec2-4ed3-8744-47b439dad275') }}</div>
                    <div>{{ $t('b29269de-a372-4125-8f70-07367bc726f3') }}</div>
                    <div>{{ $t('0a958436-5748-48af-9df9-1cef2fd0799f') }}</div>
                    <div>{{ $t('31cc1d57-79f8-4395-b247-e9852c973ba9') }}</div>
                    <div>{{ $t('915b1b4a-3115-4cee-b180-506213cd0ae0') }}</div>
                    <div>{{ $t('e30a51d3-4b1a-48f2-9a7b-6a0c53a7ea8a') }}</div>
                </div>
                <div v-for="(week, index) in weeks" :key="index" class="row">
                    <button v-for="day in week" :key="day.number" type="button" :class="{selected: day.selected, 'other-month': day.otherMonth}" :disabled="isDisabled(day)" @click="onSelect(day)">
                        {{ day.number }}
                    </button>
                </div>
            </div>
            <footer>
                <button v-if="allowClear" type="button" class="button text" @click="clear">
                    {{ $t('032d7766-c134-4b11-80a9-251aeeddd40f') }}
                </button>
                <button v-if="!isDisabled({value: DateTime.now()})" type="button" class="button text" @click="setToday">
                    {{ $t('2cae4f4c-7687-4cbc-9511-8ed0dd7f77ee') }}
                </button>
            </footer>
        </aside>
    </ContextMenuView>
</template>

<script lang="ts" setup>
import { useDismiss, usePop } from '@simonbackx/vue-app-navigation';
import { Formatter } from '@stamhoofd/utility';
import { DateTime } from 'luxon';
import { computed, onBeforeUnmount, onMounted, useTemplateRef } from 'vue';
import ContextMenuView from './ContextMenuView.vue';

type Day = {
    number: number;
    value: DateTime;
    otherMonth: boolean;
    selected: boolean;
};

type Week = Day[];

const props = withDefaults(defineProps<{
    setDate: (date: Date | null) => void;
    onClose: () => void;
    selectedDay: Date;
    min?: Date | null;
    max?: Date | null;
    autoDismiss?: boolean;
    allowClear?: boolean;
    time?: { hours: number; minutes: number; seconds: number; millisecond?: number } | null;
}>(), {
    min: null,
    max: null,
    autoDismiss: true,
    allowClear: false,
    time: null,
});

const pop = usePop();
const aside = useTemplateRef<HTMLElement>('aside');

const luxonSelectedDay = computed(() => Formatter.luxon(props.selectedDay));
const luxonMin = computed(() => props.min ? Formatter.luxon(props.min) : null);
const luxonMax = computed(() => props.max ? Formatter.luxon(props.max) : null);
const weeks = computed(() => generateDays(luxonSelectedDay.value));
const dismiss = useDismiss();

onBeforeUnmount(() => props.onClose());
onMounted(() => {
    if (!props.autoDismiss) {
        aside.value?.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });
    }
});

function setTime(dateTime: DateTime): DateTime {
    if (props.time) {
        return dateTime.set({
            hour: props.time.hours,
            minute: props.time.minutes,
            second: props.time.seconds,
            millisecond: props.time.millisecond ?? 0,
        });
    }

    return dateTime;
}

function isYearDisabled(year: number) {
    if (luxonMin.value !== null) {
        if (year < luxonMin.value.year) {
            return true;
        }
    }

    if (luxonMax.value !== null) {
        if (year > luxonMax.value.year) {
            return true;
        }
    }

    return false;
}

const isPreviousMonthDisabled = computed(() => {
    const dateTime = luxonSelectedDay.value.minus({ month: 1 });
    return isMonthDisabled(dateTime.year, dateTime.month);
});

const isNextMonthDisabled = computed(() => {
    const dateTime = luxonSelectedDay.value.plus({ month: 1 });
    return isMonthDisabled(dateTime.year, dateTime.month);
});

function isMonthDisabled(year: number, month: number) {
    const dateTime = setTime(DateTime.fromObject({ year, month, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 }, { zone: Formatter.timezone }).setZone(Formatter.timezone));

    if (luxonMin.value !== null) {
        if (dateTime.endOf('month') < luxonMin.value) {
            return true;
        }
    }

    if (luxonMax.value !== null) {
        if (dateTime.startOf('month') > luxonMax.value) {
            return true;
        }
    }

    return false;
}

function isDisabled(day: { value: DateTime }) {
    if (props.time) {
        const dateTime = day.value.set({
            hour: props.time.hours,
            minute: props.time.minutes,
            second: props.time.seconds,
            millisecond: props.time.millisecond ?? 0,
        });

        if (luxonMin.value && dateTime < luxonMin.value) {
            return true;
        }
        if (luxonMax.value && dateTime > luxonMax.value) {
            return true;
        }
        return false;
    }

    const dateTime = day.value;

    // if no specific time set => not disabled if same date
    if (luxonMin.value && dateTime < luxonMin.value) {
        return dateTime.day !== luxonMin.value.day || dateTime.month !== luxonMin.value.month || dateTime.year !== luxonMin.value.year;
    }
    if (luxonMax.value && dateTime > luxonMax.value) {
        return dateTime.day !== luxonMax.value.day || dateTime.month !== luxonMax.value.month || dateTime.year !== luxonMax.value.year;
    }
    return false;
}

function generateDays(dateTime: DateTime) {
    let start = dateTime.set({ day: 1 });

    const month = start.month;
    const year = start.year;

    // Make sure first day is 1
    while (start.weekday !== 1) {
        start = start.minus({ day: 1 });
    }

    const weeks: Week[] = [];

    // loop days
    while ((start.month <= month && start.year === year) || start.year < year || start.weekday !== 1) {
        if (start.weekday === 1) {
            // Start new week
            weeks.push([]);
        }

        weeks[weeks.length - 1].push({
            number: start.day,
            value: start,
            otherMonth: start.month !== month,
            selected: start.day === dateTime.day && start.year === dateTime.year && start.month === dateTime.month,
        });

        start = start.plus({ day: 1 });

        if (weeks[weeks.length - 1].length > 7 || weeks.length > 6) {
            console.error('Calendar infinite loop');
            break;
        }
    }

    return weeks;
}

function clear() {
    props.setDate(null);
    pop()?.catch(console.error);
}

function setDateValue(dateTime: DateTime) {
    props.setDate(dateTime.toJSDate());
}

function setToday() {
    setDateValue(DateTime.now());
    pop()?.catch(console.error);
}

function nextMonth() {
    month.value = month.value + 1;
}

function previousMonth() {
    month.value = month.value - 1;
}

function onSelect(day: { value: DateTime; selected: boolean }) {
    day.selected = true;
    setDateValue(day.value);
    pop()?.catch(console.error);
}

const nowYear = computed(() => {
    const ny = new Date().getFullYear();

    if (currentYear.value < ny - 50) {
        return currentYear.value + 50;
    }
    if (currentYear.value > ny) {
        return currentYear.value;
    }
    return ny;
});

const currentYear = computed({ get: () => luxonSelectedDay.value.year,
    set: (year: number) => {
        if (!year) {
            // Weird vue thing
            return;
        }
        setDateValue(luxonSelectedDay.value.set({ year }));
    },
});

const month = computed({
    get: () => luxonSelectedDay.value.month,
    set: (month: number) => {
        setDateValue(luxonSelectedDay.value.set({ month }));
    },
});

function monthText(month: number) {
    return Formatter.capitalizeFirstLetter(Formatter.month(month));
}

defineExpose({
    dismiss,
});
</script>
<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss' as *;

.date-selection-view {
    min-width: 300px;
    user-select: none;

    @media (max-width: 400px) {
        min-width: calc(100vw - 30px - 40px - 4px);
    }

    > header{
        padding: 10px 0px;
        display: flex;
        flex-direction: row;
        align-items: center;

        > h1 {
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: row;

            flex-grow: 1;
            @extend .style-title-3;
        }

        .input-icon-container {
            @extend .style-title-3;

            select {
                color: $color-dark;
            }
        }
    }

    > footer{
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
    }

    .title-button {
        display: inline-flex;
        flex-direction: row;
        align-items: center;

        > .icon {
            margin-left: -2px;
            margin-right: -2px;
        }
    }

    > .days {
        padding-bottom: 10px;

        > .days {
            display: flex;
            padding: 0px 0px;
            padding-bottom: 7px;
            margin-bottom: 5px;
            border-bottom: $border-width solid $color-border;

            > div {
                flex-grow: 1;
                flex-basis: 0;
                position: relative;
                z-index: 1;
                margin: 0;
                padding: 5px 0;
                text-align: center;
                @extend .style-interactive-small;
            }
        }

        > .row {
            display: flex;
            padding: 3px 0px;

            > button {
                flex-grow: 1;
                flex-basis: 0;
                position: relative;
                z-index: 1;
                margin: 0;
                padding: 7px 0;
                text-align: center;

                @media (max-width: 400px) {
                    padding: 12px 0;
                }

                cursor: pointer;
                touch-action: manipulation;
                user-select: none;
                transition: color 0.2s;

                @extend .style-interactive-small;

                &::after {
                    position: absolute;
                    content: '';
                    left: 0;
                    top: 0;
                    right: 0;
                    bottom: 0;
                    z-index: -1;
                    border-radius: $border-radius;
                    background: $color-background;
                    background: var(--color-current-background, #{$color-background});
                    transition: background-color 0.2s, transform 0.2s;
                    transform: scale(0.9, 0.9);
                }

                &:active, &:hover {

                    &::after {
                        background: var(--color-current-background-shade, #{$color-background-shade});
                        transform: scale(1, 1);
                    }
                }

                &:active {
                    color: white;

                    &::after {
                        background: $color-gray-1;
                        transform: scale(0.9, 0.9);
                    }
                }

                &.selected {
                    color: $color-primary-contrast;
                    font-weight: bold;

                    &::after {
                        background: $color-primary;
                        transform: scale(1, 1);
                    }

                    &:hover {
                        color: $color-background;

                        &::after {
                            background: $color-dark;
                        }
                    }

                    &:active {
                        &::after {
                            transform: scale(0.9, 0.9);
                        }
                    }
                }

                &:disabled {
                    opacity: 0.3;
                    cursor: not-allowed;

                    &:hover {
                        &::after {
                            background: var(--color-current-background, #{$color-background});
                        }
                    }
                }

                &.other-month {
                    opacity: 0.3;

                    &:disabled {
                        opacity: 0.2;
                    }
                }

            }
        }
    }
}
</style>
