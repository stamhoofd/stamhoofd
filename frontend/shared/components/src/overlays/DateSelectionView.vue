<template>
    <ContextMenu v-bind="{ x, y, xPlacement: 'left', preferredWidth }">
        <aside class="date-selection-view">
            <header>
                <button class="button icon gray arrow-left" @click="previousMonth" />
                <h1>{{ monthTitle }}</h1>
                <button class="button icon gray arrow-right" @click="nextMonth" />
            </header>
            <div>
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
                    <button v-for="day in week" :key="day.number" :class="{selected: day.selected, 'other-month': day.otherMonth}" @click="onSelect(day)">
                        {{ day.number }}
                    </button>
                </div>
            </div>
        </aside>
    </ContextMenu>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Formatter } from "@stamhoofd/utility"
import { Component, Mixins,Prop } from "vue-property-decorator";

import ContextMenu from "./ContextMenu.vue";

@Component({
    components: {
        ContextMenu
    },
})
export default class DateSelectionView extends Mixins(NavigationMixin) {
    @Prop({ default: 0 })
    x!: number;

    @Prop({ default: 0 })
    y!: number;

    @Prop()
    preferredWidth?: number;

    @Prop()
    setDate!: (date: Date) => void;

    @Prop({ default: null })
    selectedDay!: Date | null
    currentMonth: Date = new Date((this.selectedDay ?? new Date()).getTime())
    weeks: any = null
    monthTitle = ""

    created() {
        this.weeks = this.generateDays()
        this.updateMonthTitle()
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

    updateMonthTitle() {
        this.monthTitle = Formatter.capitalizeFirstLetter(Formatter.month(this.currentMonth.getMonth() + 1))
        this.monthTitle += " "+this.currentMonth.getFullYear()
    }

    nextMonth() {
        this.currentMonth.setDate(1)
        this.currentMonth.setMonth(this.currentMonth.getMonth() + 1)
        this.updateMonthTitle();
        this.weeks = this.generateDays()
    }

    previousMonth() {
        this.currentMonth.setDate(0)
        this.currentMonth.setDate(1)
        this.updateMonthTitle();
        this.weeks = this.generateDays()
    }

    nextYear() {
        this.currentMonth.setFullYear(this.currentMonth.getFullYear() + 1)
        this.updateMonthTitle();
        this.weeks = this.generateDays()
    }

    previousYear() {
        this.currentMonth.setFullYear(this.currentMonth.getFullYear() - 1)
        this.updateMonthTitle();
        this.weeks = this.generateDays()
    }

    onSelect(day) {
        day.selected = true;
        this.setDate(day.value)
        this.pop();
    }

    activated() {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        document.addEventListener("keydown", this.onKey);
    }

    deactivated() {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        document.removeEventListener("keydown", this.onKey);
    }

    onKey(event) {
        if (event.defaultPrevented || event.repeat) {
            return;
        }

        const key = event.key || event.keyCode;

        if (key === "ArrowLeft") {
            this.previousMonth();
            event.preventDefault();
        } else if (key === "ArrowRight") {
            this.nextMonth();
            event.preventDefault();
        } else if (key === "ArrowUp" || key === "PageUp") {
            this.nextYear();
            event.preventDefault();
        } else if (key === "ArrowDown" || key === "PageDown") {
            this.previousYear();
            event.preventDefault();
        }
    }

}
</script>
<style lang="scss">
@use "~@stamhoofd/scss/base/variables.scss" as *;
@use '~@stamhoofd/scss/base/text-styles.scss' as *;

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
            flex-grow: 1;
            text-align: center;
            @extend .style-title-3;
        }
    }

    > div {
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
                    background: $color-white;
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
                    color: white;
                    font-weight: bold;

                    &::after {
                        background: $color-primary;
                        transform: scale(1, 1);
                    }

                    &:hover {
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
