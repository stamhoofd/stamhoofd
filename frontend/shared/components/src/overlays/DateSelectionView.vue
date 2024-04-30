<template>
    <ContextMenuView v-bind="$attrs" :auto-dismiss="autoDismiss">
        <aside ref="aside" class="date-selection-view">
            <header>
                <button type="button" class="button icon gray arrow-left" @click="previousMonth" />
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
                <button type="button" class="button icon gray arrow-right" @click="nextMonth" />
            </header>
            <div class="days">
                <div class="days">
                    <div>Ma</div>
                    <div>Di</div>
                    <div>Wo</div>
                    <div>Do</div>
                    <div>Vr</div>
                    <div>Za</div>
                    <div>Zo</div>
                </div>
                <div v-for="(week, index) in weeks" :key="index" class="row">
                    <button v-for="day in week" :key="day.number" type="button" :class="{selected: day.selected, 'other-month': day.otherMonth}" @click="onSelect(day)">
                        {{ day.number }}
                    </button>
                </div>
            </div>
            <footer>
                <button v-if="allowClear" type="button" class="button text" @click="clear">
                    Leegmaken
                </button>
                <button type="button" class="button text" @click="setToday">
                    Vandaag
                </button>
            </footer>
        </aside>
    </ContextMenuView>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Formatter } from "@stamhoofd/utility"
import { Component, Mixins,Prop } from "vue-property-decorator";

import LongPressDirective from "../directives/LongPress";
import Dropdown from "../inputs/Dropdown.vue";
import ContextMenuView from "./ContextMenuView.vue";

@Component({
    components: {
        ContextMenuView,
        Dropdown
    },
    directives: {
        LongPress: LongPressDirective
    }
})
export default class DateSelectionView extends Mixins(NavigationMixin) {
    @Prop()
        setDate!: (date: Date | null) => void;

    @Prop()
        onClose!: () => void;

    @Prop({ default: true })
        autoDismiss!: boolean;

    @Prop({ required: true })
        selectedDay!: Date
    currentMonth: Date = new Date((this.selectedDay ?? new Date()).getTime())
    weeks: any = null
    monthTitle = ""
    yearTitle = ""

    @Prop({ default: false })
        allowClear!: boolean

    created() {
        this.weeks = this.generateDays()
        this.updateMonthTitle()
    }

    beforeUnmount() {
        this.onClose()
    }

    mounted() {
        if (!this.autoDismiss) {
            (this.$refs?.aside as any)?.addEventListener("mousedown", (e) => {
                e.preventDefault()
            });
        }
    }

    generateDays() {
        const weeks: any = [];

        const start = new Date(this.currentMonth.getTime())
        start.setDate(1)

        const month = start.getMonth()
        const year = start.getFullYear()

        // Make sure first day is 1
        while (start.getDay() != 1) {
            start.setDate(start.getDate() - 1)
        }

        // loop days
        while ((start.getMonth() <= month && start.getFullYear() == year) || start.getFullYear() < year || start.getDay() != 1) {
            if (start.getDay() == 1) {
                // Start new week
                weeks.push([])
            }

            weeks[weeks.length - 1].push({
                number: start.getDate(),
                value: new Date(start.getTime()),
                otherMonth: start.getMonth() != month,
                selected: this.selectedDay && start.getDate() == this.selectedDay.getDate() && start.getFullYear() == this.selectedDay.getFullYear() && start.getMonth() == this.selectedDay.getMonth()
            })

            start.setDate(start.getDate() + 1)

            if (weeks[weeks.length - 1].length > 7 || weeks.length > 6) {
                console.error("Calendar infinite loop")
                break;
            }
        }
        return weeks
    }

    clear() {
        this.setDate(null)
        this.pop();
    }

    setDateValue(date: Date) {
        const selectedDay = this.selectedDay
        selectedDay.setTime(date.getTime())
        this.currentMonth = new Date(selectedDay.getTime())
        this.weeks = this.generateDays()
        this.updateMonthTitle()
        this.setDate(new Date(date.getTime()))
    }

    setToday() {
        this.setDateValue(new Date())
        this.pop();
    }

    updateMonthTitle() {
        this.monthTitle = Formatter.capitalizeFirstLetter(Formatter.month(this.currentMonth.getMonth() + 1));
        this.yearTitle = this.currentMonth.getFullYear().toString()
    }

    nextMonth() {
        this.month = this.month + 1
    }

    updateSelectedMonth() {
        if (!this.selectedDay) {
            return
        }
        // Don't make a copy
        const selectedDay = this.selectedDay
        const day = selectedDay.getDate();
        selectedDay.setMonth(this.currentMonth.getMonth())
        selectedDay.setMonth(this.currentMonth.getMonth())
        selectedDay.setFullYear(this.currentMonth.getFullYear())
        if (selectedDay.getDate() < day) {
            selectedDay.setDate(new Date(selectedDay.getFullYear(), selectedDay.getMonth() + 1, 0).getDate())
        }
        this.setDate(selectedDay)
    }

    previousMonth() {
        const d = new Date(this.currentMonth)
        d.setDate(0)
        d.setDate(1)
        this.setDateValue(d)
    }

    nextYear() {
        this.currentYear = this.currentYear + 1
    }

    previousYear() {
        this.currentYear = this.currentYear - 1
    }

    onSelect(day) {
        day.selected = true;
        this.setDate(day.value)
        this.pop();
    }

    get nowYear() {
        const ny = new Date().getFullYear(); 

        if (this.currentYear < ny - 50) {
            return this.currentYear + 50
        }
        if (this.currentYear > ny) {
            return this.currentYear
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
        const d = new Date(this.currentMonth)
        d.setFullYear(year)

        this.currentMonth = d
        this.updateSelectedMonth()
        this.updateMonthTitle();
        this.weeks = this.generateDays()
    }

    get month() {
        // Date is not reactive
        return this.currentMonth.getMonth() + 1;
    }

    set month(month: number) {
        if (!month) {
            // Weird vue thing
            return;
        }
        const d = new Date(this.currentMonth)
        d.setDate(1)
        d.setMonth(month - 1)

        this.currentMonth = d
        this.updateSelectedMonth()
        this.updateMonthTitle();
        this.weeks = this.generateDays()
    }

    monthText(month: number) {
        return Formatter.capitalizeFirstLetter(Formatter.month(month))
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

                &.other-month {
                    opacity: 0.3;
                }
            }
        }
    }
}
</style>
