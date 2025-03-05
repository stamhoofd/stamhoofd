<template>
    <ContextMenuView v-bind="$attrs" :auto-dismiss="autoDismiss">
        <aside ref="aside" class="date-selection-view">
            <header>
                <button type="button" class="button icon gray arrow-left" @click="previousMonth"/>
                <h1>
                    <div class="input-icon-container right icon arrow-down-small gray">
                        <select v-model="month" @mousedown.stop>
                            <option v-for="month in 12" :key="month" :value="month">
                                {{ monthText(month) }}
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
                    <div>{{ $t('5b4fc512-073a-4869-bab5-db8013206219') }}</div>
                    <div>{{ $t('4f6c200b-9f81-4cd7-921d-802ed8d90603') }}</div>
                    <div>{{ $t('dfe7701d-b87f-4083-ad09-81aaee54fee6') }}</div>
                    <div>{{ $t('8d8c5343-f79f-4eaf-8bed-37b4b345d469') }}</div>
                    <div>{{ $t('6bf9fe12-320a-4f4a-b66a-feefe88bb575') }}</div>
                    <div>{{ $t('72c51d37-aca8-475c-8246-e18db092c896') }}</div>
                    <div>{{ $t('de249ffc-a3f6-4852-86e8-421a2007adf0') }}</div>
                </div>
                <div v-for="(week, index) in weeks" :key="index" class="row">
                    <button v-for="day in week" :key="day.number" type="button" :class="{selected: day.selected, 'other-month': day.otherMonth}" :disabled="isDisabled(day)" @click="onSelect(day)">
                        {{ day.number }}
                    </button>
                </div>
            </div>
            <footer>
                <button v-if="allowClear" type="button" class="button text" @click="clear">
                    {{ $t('3932e528-79c6-41ac-9dac-acaf046e9e22') }}
                </button>
                <button v-if="!isDisabled({value: new Date()})" type="button" class="button text" @click="setToday">
                    {{ $t('ac201fe7-6eb7-4a01-88f2-7f33506ec890') }}
                </button>
            </footer>
        </aside>
    </ContextMenuView>
</template>

<script lang="ts">
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';
import { Formatter } from '@stamhoofd/utility';

import LongPressDirective from '../directives/LongPress';
import Dropdown from '../inputs/Dropdown.vue';
import ContextMenuView from './ContextMenuView.vue';

@Component({
    components: {
        ContextMenuView,
        Dropdown,
    },
    directives: {
        LongPress: LongPressDirective,
    },
})
export default class DateSelectionView extends Mixins(NavigationMixin) {
    @Prop()
    setDate!: (date: Date | null) => void;

    @Prop()
    onClose!: () => void;

    @Prop({ default: true })
    autoDismiss!: boolean;

    @Prop({ required: true })
    selectedDay!: Date;

    @Prop({ default: null })
    min!: Date | null;

    @Prop({ default: null })
    max!: Date | null;

    currentMonth: Date = new Date((this.selectedDay ?? new Date()).getTime());
    weeks: any = null;
    monthTitle = '';
    yearTitle = '';

    @Prop({ default: false })
    allowClear!: boolean;

    created() {
        this.weeks = this.generateDays();
        this.updateMonthTitle();
    }

    beforeUnmount() {
        this.onClose();
    }

    mounted() {
        if (!this.autoDismiss) {
            (this.$refs?.aside as any)?.addEventListener('mousedown', (e) => {
                e.preventDefault();
            });
        }
    }

    isDisabled(day: { value: Date }) {
        if (this.min && day.value.getTime() < this.min.getTime()) {
            return true;
        }
        if (this.max && day.value.getTime() > this.max.getTime()) {
            return true;
        }
        return false;
    }

    generateDays() {
        const weeks: any = [];

        const start = new Date(this.currentMonth.getTime());
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
                selected: this.selectedDay && start.getDate() === this.selectedDay.getDate() && start.getFullYear() === this.selectedDay.getFullYear() && start.getMonth() === this.selectedDay.getMonth(),
            });

            start.setDate(start.getDate() + 1);

            if (weeks[weeks.length - 1].length > 7 || weeks.length > 6) {
                console.error('Calendar infinite loop');
                break;
            }
        }
        return weeks;
    }

    clear() {
        this.setDate(null);
        this.pop();
    }

    setDateValue(date: Date) {
        const selectedDay = this.selectedDay;
        selectedDay.setTime(date.getTime());
        this.currentMonth = new Date(selectedDay.getTime());
        this.weeks = this.generateDays();
        this.updateMonthTitle();
        this.setDate(new Date(date.getTime()));
    }

    setToday() {
        this.setDateValue(new Date());
        this.pop();
    }

    updateMonthTitle() {
        this.monthTitle = Formatter.capitalizeFirstLetter(Formatter.month(this.currentMonth.getMonth() + 1));
        this.yearTitle = this.currentMonth.getFullYear().toString();
    }

    nextMonth() {
        this.month = this.month + 1;
    }

    updateSelectedMonth() {
        if (!this.selectedDay) {
            return;
        }
        // Don't make a copy
        const selectedDay = this.selectedDay;
        const day = selectedDay.getDate();
        selectedDay.setMonth(this.currentMonth.getMonth());
        selectedDay.setMonth(this.currentMonth.getMonth());
        selectedDay.setFullYear(this.currentMonth.getFullYear());
        if (selectedDay.getDate() < day) {
            selectedDay.setDate(new Date(selectedDay.getFullYear(), selectedDay.getMonth() + 1, 0).getDate());
        }
        this.setDate(selectedDay);
    }

    previousMonth() {
        this.month = this.month - 1;
    }

    nextYear() {
        this.currentYear = this.currentYear + 1;
    }

    previousYear() {
        this.currentYear = this.currentYear - 1;
    }

    onSelect(day) {
        console.log('Select', day);
        day.selected = true;
        this.setDate(day.value);
        this.pop();
    }

    get nowYear() {
        const ny = new Date().getFullYear();

        if (this.currentYear < ny - 50) {
            return this.currentYear + 50;
        }
        if (this.currentYear > ny) {
            return this.currentYear;
        }
        return ny;
    }

    get currentYear() {
        return this.currentMonth.getFullYear();
    }

    set currentYear(year: number) {
        if (!year) {
            // Weird vue thing
            return;
        }
        const d = new Date(this.currentMonth);
        d.setFullYear(year);
        this.setDateValue(d);
    }

    get month() {
        // Date is not reactive
        return this.currentMonth.getMonth() + 1;
    }

    set month(month: number) {
        console.log('Set month', month);
        const d = new Date(this.currentMonth);
        d.setDate(1);
        if (month < 1) {
            month = 12;
            d.setMonth(month - 1);
            d.setFullYear(this.currentMonth.getFullYear() - 1);
        }
        d.setMonth(month - 1);
        d.setDate(this.currentMonth.getDate());

        // If date overflowed
        if (d.getDate() !== this.currentMonth.getDate()) {
            d.setTime(this.currentMonth.getTime());
            d.setDate(1);
            d.setMonth(month);
            d.setDate(0);
        }

        this.setDateValue(d);
    }

    monthText(month: number) {
        return Formatter.capitalizeFirstLetter(Formatter.month(month));
    }
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
