<template>
    <div class="st-view group-members-view background">
        <STNavigationBar :sticky="true">
            <template #left>
                <BackButton v-if="canPop" slot="left" @click="pop" />
            </template>
            <template #right>
                <button class="button text" @click="showSelection = !showSelection">
                    Select...
                </button>
                <button class="button text" @click="wrapColumns = !wrapColumns">
                    Wrap...
                </button>
                <button class="button text" @click="simulateDataChange">
                    Change
                </button>
            </template>
        </STNavigationBar>
    
        <main>
            <h1>Table</h1>

            <div class="input-with-buttons title-description">
                <div>
                    <div class="input-icon-container icon search gray">
                        <input v-model="searchQuery" class="input" placeholder="Zoeken" @input="searchQuery = $event.target.value">
                    </div>
                </div>
                <div>
                    <button class="button text" @click="editFilter">
                        <span class="icon filter" />
                        <span class="hide-small">Filter</span>
                        <span v-if="filteredCount > 0" class="bubble">{{ filteredCount }}</span>
                    </button>
                </div>
            </div>

            <div class="table-with-columns" :class="{ wrap: wrapColumns }">
                <div class="table-head">
                    <div v-if="showSelection" class="selection-column">
                        <Checkbox :checked="cachedAllSelected" @change="setSelectAll($event)" />
                    </div>

                    <div class="columns" :class="{ 'show-checkbox': showSelection }">
                        <div v-for="column of columns" :key="column.id" @click="toggleSort(column)">
                            {{ column.name }}

                            <span
                                class="sort-arrow icon"
                                :class="{
                                    'arrow-up-small': sortBy === column && sortDirection == 'ASC',
                                    'arrow-down-small': sortBy === column && sortDirection == 'DESC',
                                }"
                            />
                        </div>
                    </div>
                </div>

                <div ref="tableBody" class="table-body" :style="{ height: totalHeight+'px'}">
                    <div v-for="row of visibleRows" :key="row.id" class="table-row" :class="{ selectable: !!clickHandler }" :style="{ transform: 'translateY('+row.y+'px)', height: rowHeight+'px', display: row.currentIndex === null ? 'none' : '' }">
                        <div v-if="showSelection" class="selection-column">
                            <Checkbox v-if="row.value" :key="row.value.id" :checked="row.cachedSelectionValue" @change="setSelectionValue(row, $event)" />
                        </div>
                        <div class="columns" :class="{ 'show-checkbox': showSelection }">
                            <div v-for="column of columns" :key="column.id">
                                <span v-if="!row.value" class="placeholder-skeleton" />
                                <span v-else>
                                    {{ row.value ? column.getValue(row.value) : "" }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>
</template>


<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, FilterEditor, STNavigationBar } from "@stamhoofd/components"
import { Filter, FilterDefinition } from "@stamhoofd/structures";
import { StringFilterDefinition } from "@stamhoofd/structures/esm/dist";
import { StringCompare } from "@stamhoofd/utility";
import { Sorter } from "@stamhoofd/utility";
import { v4 as uuidv4 } from "uuid";
import { Component, Mixins, Watch } from "vue-property-decorator";

interface Searchable {
    matchQuery(query: string): boolean;
}

class TestValue implements Searchable {
    id: string
    name: string
    age: number
    status: string

    constructor(id: string, name: string, age: number, status: string) {
        this.id = id
        this.name = name
        this.age = age
        this.status = status
    }

    matchQuery(query: string): boolean {
        return StringCompare.contains(this.name, query)
    }
}

class Column<T> {
    name: string
    getValue: (val: T) => string
    compare: (a: T, b: T) => number

    constructor(name: string, getValue: (val: T) => string, compare: (a: T, b: T) => number) {
        this.name = name
        this.getValue = getValue
        this.compare = compare
    }

    get id() {
        return this.name
    }
}

class VisibleRow<T> {
    id = uuidv4()
    y = 0
    currentIndex: null | number = null

    /**
     * If row is not set, this means that it can be reused again + that it shouldn't get rendered
     */
    value: T | null = null

    cachedSelectionValue = false

}

@Component({
    components: {
        STNavigationBar,
        BackButton,
        Checkbox
    },
})
export default class TableView extends Mixins(NavigationMixin) {

    // This contains the data we want to show, already sorted
    allValues: TestValue[] = []

    //@Prop({ required: true})
    filterDefinitions: FilterDefinition<TestValue, any, any>[] = [
        new StringFilterDefinition({
            id: "name",
            name: "Name",
            getValue: (value: TestValue) => value.name,
        }),
    ]

    selectedFilter: Filter<TestValue> | null = null
    searchQuery = ""

    //@Prop({ required: true})
    columns: Column<TestValue>[] = [
        new Column("Naam", (v) => v.name, (a, b) => Sorter.byStringValue(a.name, b.name)),
        new Column("Leeftijd", (v) => v.age+" jaar", (a, b) => -1 * Sorter.byNumberValue(a.age, b.age)),
        new Column("Status", (v) => v.status, (a, b) => Sorter.byStringValue(a.status, b.status))
    ]

    //@Prop({ default: true})
    showSelection = true
    wrapColumns = true

    //@Prop({ default: null })
    clickHandler: ((value: TestValue) => void) | null = (val: TestValue) => {
        // todo: show details
    }

    sortBy: Column<TestValue> = this.columns[0]
    sortDirection: "ASC" | "DESC" = "ASC"

    visibleRows: VisibleRow<TestValue>[] = []

    // If the user selects a row, we'll add it in the selectedRows. But if the user selects all rows, 
    // we don't want to add them all, that would be a performance hit. So'ill invert it and only save the unselected values here.
    markedRows = new Map<string, TestValue>()

    /**
     * When true: only the marked rows are selected.
     * When false: all rows are selected, except the marked rows
     */
    markedRowsAreSelected = true

    get filteredCount() {
        return this.allValues.length - this.filteredValues.length
    }

    get filteredValues() {
        const filtered = this.selectedFilter === null ? this.allValues.slice() : this.allValues.filter((val: TestValue) => {
            if (this.selectedFilter?.doesMatch(val)) {
                return true;
            }
            return false;
        });

        if (this.searchQuery == "") {
            return filtered;
        }
        return filtered.filter((val: TestValue) => val.matchQuery(this.searchQuery));
    }

    editFilter() {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(FilterEditor, {
                definitions: this.filterDefinitions,
                selectedFilter: this.selectedFilter,
                //organization: OrganizationManager.organization,
                setFilter: (filter: Filter<any>) => {
                    this.selectedFilter = filter
                }
            })
        }).setDisplayStyle("side-view"))
    }


    get sortedValues() {
        const m = (this.sortDirection === "ASC" ? 1 : -1)
        return this.filteredValues.sort((a, b) => this.sortBy.compare(a, b) * m)
    }

    toggleSort(column: Column<any>) {
        if (this.sortBy === column) {
            if (this.sortDirection == "ASC") {
                this.sortDirection = "DESC";
            } else {
                this.sortDirection = "ASC";
            }
            return;
        }
        this.sortBy = column;
    }

    setValues(allValues: TestValue[]) {
        this.allValues = allValues
    }

    getSelectionValue(row: VisibleRow<TestValue>) {
        const value = row.value
        if (!value) {
            return false
        }

        const found = this.markedRows.has(value.id)

        if (this.markedRowsAreSelected) {
            return found
        } else {
            return !found
        }
    }

    setSelectionValue(row: VisibleRow<TestValue>, selected: boolean) {
        const value = row.value
        if (!value) {
            return
        }
        if (selected) {
            if (this.markedRowsAreSelected) {
                this.markedRows.set(value.id, value)
            } else {
                this.markedRows.delete(value.id)
            }
        } else {
            if (!this.markedRowsAreSelected) {
                this.markedRows.set(value.id, value)
            } else {
                this.markedRows.delete(value.id)
            }
        }

        row.cachedSelectionValue = selected
        

        // Update cached all selection
        this.cachedAllSelected = this.getSelectAll()
    }

    cachedAllSelected = false

    /**
     * This is not reactive, due to the use of maps, which are not reactive in vue.
     * Thats why we need a cached value.
     */
    getSelectAll(): boolean {
        if (this.markedRowsAreSelected) {
            return this.markedRows.size === this.filteredValues.length
        } else {
            return this.markedRows.size === 0
        }
    }

    setSelectAll(selected: boolean) {
        this.markedRowsAreSelected = !selected
        this.markedRows.clear()

        for (const visibleRow of this.visibleRows) {
            visibleRow.cachedSelectionValue = selected
        }
        this.cachedAllSelected = selected
    }

    @Watch("sortedValues", { deep: false })
    onUpdateValues() {
        console.info("Sorted values has changed")

        for (const visibleRow of this.visibleRows) {
            // has this row changed and should it now display a different value? -> clear it and mark it for reuse
            if (visibleRow.value && visibleRow.currentIndex !== null && (visibleRow.currentIndex >= this.sortedValues.length || visibleRow.value !== this.sortedValues[visibleRow.currentIndex])) {
                // Mark this row to be reused
                visibleRow.value = null
                visibleRow.currentIndex = null
            }
        }

        // Update all rows
        this.updateVisibleRows()
    }

    simulateDataChange() {
        this.sortedValues[0].name = this.sortedValues[0].name.split("").reverse().join("")
    }

    mounted() {
        // Initialise visible Rows
        for (let index = 0; index < 10000; index++) {
            this.allValues.push(new TestValue(uuidv4(), "Lid "+index, Math.floor(Math.random() * 99), uuidv4()));
        }

        this.updateVisibleRows();

        document.addEventListener("scroll", () => {
            this.updateVisibleRows()
        }, { passive: true })
    }


    /**
     * Cached offset between scroll and top of the table
     */
    cachedTableYPosition: number | null = 0

    updateVisibleRows() {
        if (this.sortedValues.length == 0) {
            return
        }

        const scrollElement = document.documentElement; //this.getScrollElement()
        
        // innerHeight is a fix for animations, causing wrong initial bouding client rect
        if (!this.cachedTableYPosition || this.cachedTableYPosition > window.innerHeight) {
            const tableBody = this.$refs["tableBody"] as HTMLElement
            const rect = tableBody.getBoundingClientRect();

            const top = rect.top

            if (top >= 0) {
                this.cachedTableYPosition = top + scrollElement.scrollTop
            } else {
                this.cachedTableYPosition = scrollElement.scrollTop + top
            }

            console.log("Cached table y position at "+this.cachedTableYPosition)
        }

        let topOffset = scrollElement.scrollTop - this.cachedTableYPosition

        if (topOffset >= 0) {
            // The table is not yet scrolled
            // topOffset = 0
        } else {
            topOffset = -topOffset
        }

        const extraItems = 5

        const firstVisibleItemIndex = Math.max(0, Math.min(Math.floor(topOffset / this.rowHeight) - extraItems, this.sortedValues.length - 1))

        const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)

        const lastVisibleItemIndex = Math.max(0, Math.min(Math.floor((topOffset + vh) / this.rowHeight) + extraItems, this.sortedValues.length - 1))

        //const neededCount = lastVisibleItemIndex - firstVisibleItemIndex + 1

        // Make all visible rows available if not visible any longer
        for (const visibleRow of this.visibleRows) {
            if (visibleRow.value && (visibleRow.currentIndex === null || visibleRow.currentIndex < firstVisibleItemIndex || visibleRow.currentIndex > lastVisibleItemIndex)) {
                //console.log("Freed visibleRow at index "+visibleRow.currentIndex)
                visibleRow.value = null
                visibleRow.currentIndex = null
            }
        }

        for (let index = firstVisibleItemIndex; index <= lastVisibleItemIndex; index++) {
            // Is this already visible?
            let visibleRow = this.visibleRows.find(r => r.currentIndex === index)
            if (visibleRow) {
                // Nothing to do, it's already visible
                continue
            }

            //console.log("Row at index "+index+" is not yet loaded. Searching for a spot...")
            visibleRow = this.visibleRows.find(r => r.currentIndex === null)

            if (!visibleRow) {
                //console.log("Created new cached row for index "+index)
                visibleRow = new VisibleRow<TestValue>()
                this.visibleRows.push(visibleRow)
            }

            // todo: simulate loading here
            const value = this.sortedValues[index]

            visibleRow.value = value
            visibleRow.y = index * this.rowHeight
            visibleRow.currentIndex = index
            visibleRow.cachedSelectionValue = this.getSelectionValue(visibleRow)
        }

        //console.log("Rendered rows: "+this.visibleRows.length)
    }

    get rowHeight() {
        if (this.wrapColumns) {
            const padding = 15
            const firstColumnHeight = 16
            const otherColumnsHeight = 16
            const borderHeight = 2
            const margin = 5
            return padding * 2 + firstColumnHeight + ((otherColumnsHeight + margin) * Math.max(this.columns.length - 1, 0)) + borderHeight
        }
        return 60
    }

    get totalHeight() {
        return this.rowHeight * this.filteredValues.length
    }
}
</script>

<style lang="scss">
@use '~@stamhoofd/scss/base/variables' as *;
@use '~@stamhoofd/scss/base/text-styles' as *;

.table-with-columns {
    contain: layout;
    margin: 0 calc(-1 * var(--st-horizontal-padding, 40px));

    .table-body {
        contain: layout;
        position: relative;
        overflow: hidden;
    }

    .table-row, .table-head {
        width: 100%;
        overflow: hidden;
        position: relative;
        box-sizing: border-box;

        padding-left: var(--st-horizontal-padding, 40px);

        .selection-column {
            position: absolute;
            box-sizing: border-box;
            height: 100%;
            display: flex;
            flex-wrap: nowrap;
            justify-content: stretch;
            align-items: center;
            padding-bottom: 2px;
        }

        .columns {
            box-sizing: border-box;
            width: 100%;
            height: 100%;
            transform: translateX(0);
            transition: transform 0.2s;

            &.show-checkbox {
                width: calc(100% - 50px);
                transform: translateX(50px);
            }

            > div {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
        }
    }

    &:not(.wrap) {
        .table-head, .table-row {
            .columns {
                display: flex;
                flex-wrap: nowrap;
                justify-content: stretch;
                align-items: center;

                > div {
                    flex-shrink: 0;
                    flex-grow: 1;
                    flex-basis: 0;
                }
            }
        }
    }

    &.wrap {
        .table-head {
            display: none;
        }

        .table-row {
            .columns {
                padding: 15px 0;

                > div {
                    font-size: 16px;
                    height: 16px;
                    line-height: 16px;
                    color: $color-gray;
                    box-sizing: content-box;

                    padding-bottom: 5px;

                    &:first-child {
                        font-size: 16px;
                        height: 16px;
                        line-height: 16px;
                        color: $color-dark;
                    }

                    &:last-child {
                        padding-bottom: 0;
                    }
                }

                
            }
        }
    }

    .table-head {
        height: 50px;
        border-bottom: 2px solid $color-border;

        > div {
            @extend .style-table-head;
            cursor: pointer;
            touch-action: manipulation;
            -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
            user-select: none;
        }
    }

    .table-row {
        contain: layout;
        position: absolute;
        will-change: transform;

        .columns {
            border-bottom: 2px solid $color-border;
        }

        .placeholder-skeleton {
            display: block;
            height: 1em;
            width: 150px;
            border-radius: 5px;
            background: $color-background-shade-darker;
        }

        &.selectable {
            will-change: transform, background-color;
            transition: background-color 0.15s;
            cursor: pointer;
            touch-action: manipulation;
            -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
            user-select: none;

            @media (hover: hover) {
                &:hover {
                    background-color: $color-primary-lighter;
                }
            }

            &:active {
                background-color: $color-primary-light;
            }
        }
    }
}
</style>
