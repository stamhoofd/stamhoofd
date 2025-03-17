<template>
    <ContextMenuView v-bind="$attrs" :auto-dismiss="autoDismiss">
        <aside ref="aside" class="date-selection-view">
            <header>
                <button type="button" class="button icon gray arrow-left" @click="previousMonth"/>
                <h1>
                    <div class="input-icon-container right icon arrow-down-small gray">
                        <select v-model="month" @mousedown.stop>
                            <option v-for="monthNumber in 12" :key="monthNumber" :value="monthNumber">
                                {{ monthText(monthNumber) }}
                            </option>
                        </select>
                    </div>

                    <div class="input-icon-container right icon arrow-down-small gray">
                        <select v-model="currentYear" @mousedown.stop>
                            <option v-for="year in 105" :key="year" :value="nowYear - year + 5">
                                {{ nowYear - year + 5 }}
                            </option>
                        </select>
                    </div>
                </h1>
                <button type="button" class="button icon gray arrow-right" @click="nextMonth"/>
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
                <button v-if="!isDisabled({value: new Date()})" type="button" class="button text" @click="setToday">
                    {{ $t('2cae4f4c-7687-4cbc-9511-8ed0dd7f77ee') }}
                </button>
            </footer>
        </aside>
    </ContextMenuView>
</template>

<script lang="ts" setup>
import { usePop } from '@simonbackx/vue-app-navigation';
import { Formatter } from '@stamhoofd/utility';

import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import ContextMenuView from './ContextMenuView.vue';

const props = withDefaults(defineProps<{
    setDate: (date: Date | null) => void;
    onClose: () => void;
    selectedDay: Date;
    min?: Date | null;
    max?: Date | null;
    autoDismiss?: boolean;
    allowClear?: boolean;
}>(), {
    min: null,
    max: null,
    autoDismiss: true,
    allowClear: false,
});

const pop = usePop();
const aside = useTemplateRef('aside');

const currentMonth = ref(new Date((props.selectedDay ?? new Date()).getTime()));
const weeks = ref(generateDays());
const monthTitle = ref('');
const yearTitle = ref('');

updateMonthTitle();

onBeforeUnmount(() => props.onClose());
onMounted(() => {
    if (!props.autoDismiss) {
        aside.value?.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });
    }
});

function isDisabled(day: { value: Date }) {
    if (props.min && day.value.getTime() < props.min.getTime()) {
        return true;
    }
    if (props.max && day.value.getTime() > props.max.getTime()) {
        return true;
    }
    return false;
}

function generateDays() {
    const weeks: any = [];

    const start = new Date(currentMonth.value.getTime());
    start.setDate(1);

    const month = start.getMonth();
    const year = start.getFullYear();

    // Make sure first day is 1
    while (start.getDay() !== 1) {
        start.setDate(start.getDate() - 1);
    }

    // loop days
    while ((start.getMonth() <= month && start.getFullYear() === year) || start.getFullYear() < year || start.getDay() !== 1) {
        if (start.getDay() === 1) {
            // Start new week
            weeks.push([]);
        }

        weeks[weeks.length - 1].push({
            number: start.getDate(),
            value: new Date(start.getTime()),
            otherMonth: start.getMonth() !== month,
            selected: props.selectedDay && start.getDate() === props.selectedDay.getDate() && start.getFullYear() === props.selectedDay.getFullYear() && start.getMonth() === props.selectedDay.getMonth(),
        });

        start.setDate(start.getDate() + 1);

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

function setDateValue(date: Date) {
    const selectedDay = props.selectedDay;
    selectedDay.setTime(date.getTime());
    currentMonth.value = new Date(selectedDay.getTime());
    weeks.value = generateDays();
    updateMonthTitle();
    props.setDate(new Date(date.getTime()));
}

function setToday() {
    setDateValue(new Date());
    pop()?.catch(console.error);
}

function updateMonthTitle() {
    monthTitle.value = Formatter.capitalizeFirstLetter(Formatter.month(currentMonth.value.getMonth() + 1));
    yearTitle.value = currentMonth.value.getFullYear().toString();
}

function nextMonth() {
    month.value = month.value + 1;
}

function previousMonth() {
    month.value = month.value - 1;
}

function onSelect(day: { value: Date; selected: boolean }) {
    console.log('Select', day);
    day.selected = true;
    props.setDate(day.value);
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

const currentYear = computed({ get: () => currentMonth.value.getFullYear(),
    set: (year: number) => {
        if (!year) {
            // Weird vue thing
            return;
        }
        const d = new Date(currentMonth.value);
        d.setFullYear(year);
        setDateValue(d);
    },
});

const month = computed({
    get: () => currentMonth.value.getMonth() + 1,
    set: (month: number) => {
        console.log('Set month', month);
        const d = new Date(currentMonth.value);
        d.setDate(1);
        if (month < 1) {
            month = 12;
            d.setMonth(month - 1);
            d.setFullYear(currentMonth.value.getFullYear() - 1);
        }
        d.setMonth(month - 1);
        d.setDate(currentMonth.value.getDate());

        // If date overflowed
        if (d.getDate() !== currentMonth.value.getDate()) {
            d.setTime(currentMonth.value.getTime());
            d.setDate(1);
            d.setMonth(month);
            d.setDate(0);
        }

        setDateValue(d);
    },
});

function monthText(month: number) {
    return Formatter.capitalizeFirstLetter(Formatter.month(month));
}
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
