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
                <button class="button text" @click="simulateColumnWidthChange">
                    Change
                </button>
            </template>
        </STNavigationBar>
    
        <main>
            <h1>Table</h1>

            <div class="input-with-buttons">
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
        </main>

        <div ref="table" class="table-with-columns" :class="{ wrap: wrapColumns, scroll: shouldScroll }">
            <div class="inner-size" :style="!wrapColumns ? { height: totalHeight+'px', width: totalRenderWidth+'px'} : {}">
                <div class="table-head">
                    <div v-if="showSelection" class="selection-column">
                        <Checkbox :checked="cachedAllSelected" @change="setSelectAll($event)" />
                    </div>

                    <div class="columns" :class="{ 'show-checkbox': showSelection }" :style="!wrapColumns ? { 'grid-template-columns': gridTemplateColumns } : {}">
                        <div v-for="(column, index) of columns" :key="column.id">
                            <span @click="toggleSort(column)">{{ column.name }}</span>

                            <span v-if="sortBy === column"
                                  class="sort-arrow icon"
                                  :class="{
                                      'arrow-up-small': sortDirection == 'ASC',
                                      'arrow-down-small': sortDirection == 'DESC',
                                  }"
                            />

                            <span v-if="index < columns.length - 1" class="drag-handle-container"><span class="drag-handle" @mousedown="handleDragStart($event, column)" @touchstart="handleDragStart($event, column)" /></span>
                            <button v-else-if="canCollapse" class="button light-gray icon collapse-left" @click="collapse" />
                        </div>
                    </div>
                </div>

                <div ref="tableBody" class="table-body" :style="!wrapColumns ? { height: totalHeight+'px', width: totalRenderWidth+'px'} : { height: totalHeight+'px'}">
                    <div v-for="row of visibleRows" :key="row.id" class="table-row" :class="{ selectable: !!clickHandler }" :style="{ transform: 'translateY('+row.y+'px)', height: rowHeight+'px', display: row.currentIndex === null ? 'none' : '' }">
                        <div v-if="showSelection" class="selection-column">
                            <Checkbox v-if="row.value" :key="row.value.id" :checked="row.cachedSelectionValue" @change="setSelectionValue(row, $event)" />
                        </div>
                        <div class="columns" :class="{ 'show-checkbox': showSelection }" :style="!wrapColumns ? { 'grid-template-columns': gridTemplateColumns } : {}">
                            <div v-for="column of columns" :key="column.id">
                                {{ row.value ? column.getValue(row.value) : "" }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
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

    constructor(settings: {
        name: string, 
        getValue: (val: T) => string, 
        compare: (a: T, b: T) => number,
        grow?: number,
        minimumWidth?: number,
        recommendedWidth?: number,
    }) {
        this.name = settings.name
        this.getValue = settings.getValue
        this.compare = settings.compare
        this.grow = settings?.grow ?? 1
        this.minimumWidth = settings?.minimumWidth ?? 100
        this.recommendedWidth = settings?.recommendedWidth ?? 100

        this.width = this.recommendedWidth
    }

    get id() {
        return this.name
    }

    didReachMinimum() {
        return this.width && this.width <= this.minimumWidth
    }

    /**
     * null means: generate width + save it,  based on grow property
     */
    width: number | null = null

    /**
     * renderWidth is floored version of width, to use in CSS
     */
    renderWidth: number | null = null

    /**
     * Minimum width in pixels. Best minimum is 100, because this is needed for sort icon + drag handle + padding
     */
    minimumWidth = 100

    recommendedWidth = 100

    /**
     * Used for default width (behaves like flex-grow)
     * and for resizing
     */
    grow = 1
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

    // This contains the data we want to show
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
        new Column({
            name: "Naam", 
            getValue: (v) => v.name, 
            compare: (a, b) => Sorter.byStringValue(a.name, b.name),
            grow: 1,
            minimumWidth: 100,
            recommendedWidth: 150
        }),
        new Column({
            name: "Leeftijd", 
            getValue: (v) => v.age+" jaar", 
            compare: (a, b) => -1 * Sorter.byNumberValue(a.age, b.age),
            minimumWidth: 100,
            recommendedWidth: 150
        }),
        new Column({
            name: "Status", 
            getValue: (v) => v.status, 
            compare: (a, b) => Sorter.byStringValue(a.status, b.status),
            minimumWidth: 150,
            recommendedWidth: 200
        })
    ]

    //@Prop({ default: true})
    wrapColumns = window.innerWidth < 600
    showSelection = !this.wrapColumns
    shouldScroll = window.innerWidth >= 600

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

    // Column drag helpers:
    isDraggingColumn: Column<any> | null = null
    draggingStartX = 0
    draggingInitialWidth = 0

    getEventX(event: any) {
        let x = 0;
        if (event.changedTouches) {
            const touches = event.changedTouches;
            for (const touch of touches) {
                x = touch.pageX;
            }
        } else {
            x = event.pageX;
        }
        return x;
    }

    handleDragStart(event, column: Column<any>) {
        this.draggingStartX = this.getEventX(event);
        this.isDraggingColumn = column
        this.draggingInitialWidth = column.width ?? 0
        this.attachDragHandlers()
    }

    attachDragHandlers() {
        this.updateRecommendedWidths();
        (this.$refs["table"] as HTMLElement).style.cursor = "col-resize"
        document.addEventListener("mousemove", this.mouseMove, {
            passive: false,
        });
        document.addEventListener("touchmove", this.mouseMove, {
            passive: false,
        });

        document.addEventListener("mouseup", this.mouseUp, { passive: false });
        document.addEventListener("touchend", this.mouseUp, { passive: false });
    }

    detachDragHandlers() {
        (this.$refs["table"] as HTMLElement).style.cursor = ""
        document.removeEventListener("mousemove", this.mouseMove);
        document.removeEventListener("touchmove", this.mouseMove);

        document.removeEventListener("mouseup", this.mouseUp);
        document.removeEventListener("touchend", this.mouseUp);
    }

    mouseMove(event) {
        if (!this.isDraggingColumn) {
            return
        }
        const currentX = this.getEventX(event)
        const difference = currentX - this.draggingStartX

        const currentWidth = this.totalWidth

        const newWidth = this.draggingInitialWidth + difference
        this.isDraggingColumn.width =  Math.max(newWidth, this.isDraggingColumn.minimumWidth)
        this.isDraggingColumn.renderWidth = Math.floor(this.isDraggingColumn.width)

        this.updateColumnWidth(this.isDraggingColumn, "move", currentWidth)

        // Prevent scrolling (on mobile) and other stuff
        event.preventDefault();
        return false;
    }

    mouseUp(_event) {
        if (this.isDraggingColumn) {
            this.detachDragHandlers();
            this.isDraggingColumn = null;
        }
    }

    // Methods

    mounted() {
        // Initialise visible Rows
        for (let index = 0; index < 1000; index++) {
            this.allValues.push(new TestValue(uuidv4(), "Lid "+index, Math.floor(Math.random() * 99), uuidv4()));
        }

        this.updateVisibleRows();
        this.updateRecommendedWidths();
        this.updateColumnWidth()

        if (this.shouldScroll) {
            (this.$refs["table"] as HTMLElement).addEventListener("scroll", () => {
                this.updateVisibleRows()
            }, { passive: true })
        } else {
            document.addEventListener("scroll", () => {
                this.updateVisibleRows()
            }, { passive: true })
        }

        window.addEventListener("resize", () => {
            if (this.canCollapse) {
                // Keep existing width
                this.updateCanCollapse()
            } else {
                // shrink or grow width
                this.updateColumnWidth()
            }
            this.updateVisibleRows()
        }, { passive: true })
    }

    /**
     * Loop all visible rows, and sets the recommended width of each column to the maximum width of the column.
     */
    updateRecommendedWidths() {
        const measureDiv = document.createElement("div")
        measureDiv.style.position = "absolute"
        measureDiv.style.visibility = "hidden"
        measureDiv.className = "table-column-content-style"
        document.body.appendChild(measureDiv)

        for (const column of this.columns) {
            let maximum = column.minimumWidth

            // Title
            const text = column.name
            measureDiv.innerText = text
            const width = measureDiv.clientWidth
            if (width > maximum) {
                maximum = width
            }

            for (const visibleRow of this.visibleRows) {
                const value = visibleRow.value

                if (!value) {
                    continue
                }

                const text = column.getValue(value)

                measureDiv.innerText = text
                const width = measureDiv.clientWidth
                if (width > maximum) {
                    maximum = width
                }
            }

            // Also add some padding
            column.recommendedWidth = maximum + 50
        }

        document.body.removeChild(measureDiv)
    }

    canCollapse = false

    /**
     * Update the width of the columns by distributing the available width across the columns, except the ignored column (optional)
     */
    updateColumnWidth(afterColumn: Column<any> | null = null, strategy: "grow" | "move" = "grow", forceWidth: number | null = null) {
        const leftPadding = 40
        const rightPadding = 40

        const availableWidth = (forceWidth ?? (this.$refs["table"] as HTMLElement).clientWidth) - this.selectionColumnWidth - leftPadding - rightPadding;
        const currentWidth = this.columns.reduce((acc, col) => acc + (col.width ?? 0), 0);
        let distributeWidth = availableWidth - currentWidth;

        const affectedColumns = afterColumn ? this.columns.slice(this.columns.findIndex(c => c === afterColumn ) + 1) : this.columns

        if (strategy === "grow") {
            // Step 1: use recommendedWidth as minimum width in first round
            let growTotal = affectedColumns.reduce((acc, col) => acc + ((distributeWidth < 0 && col.width !== null && col.width <= col.recommendedWidth) ? 0 : col.grow), 0);
            
            while (distributeWidth != 0 && growTotal > 0) {
                const widthPerGrow = distributeWidth / growTotal;
                distributeWidth = 0
                growTotal = 0

                for (let col of affectedColumns) {
                    if (widthPerGrow < 0 && col.width !== null && col.width <= col.recommendedWidth) {
                        continue;
                    }

                    if (col.width == null) {
                        col.width = 0
                    } 
                    const change = col.grow * widthPerGrow
                    col.width += change;

                    if (change < 0 && col.width <= col.recommendedWidth) {
                        // we hit the minimum width, so we need to distribute the width that we couldn't absorb
                        const couldNotAbsorb = col.recommendedWidth - col.width
                        distributeWidth -= couldNotAbsorb;
                        col.width = col.recommendedWidth;
                    }
                    
                    // Can we absorb the next shrink? (if shrinking)
                    if (!(widthPerGrow < 0 && col.width !== null && col.width <= col.recommendedWidth)) {
                        growTotal += col.grow;
                    }

                    col.renderWidth = Math.floor(col.width);
                }
            }

            if (distributeWidth != 0) {
                // Step 2: use real minimum width (if still needed)
                growTotal = affectedColumns.reduce((acc, col) => acc + ((distributeWidth < 0 && col.width !== null && col.width <= col.minimumWidth) ? 0 : col.grow), 0);
            
                while (distributeWidth != 0 && growTotal > 0) {
                    const widthPerGrow = distributeWidth / growTotal;

                    distributeWidth = 0
                    growTotal = 0

                    for (let col of affectedColumns) {
                        if (widthPerGrow < 0 && col.width !== null && col.width <= col.minimumWidth) {
                            continue;
                        }

                        if (col.width == null) {
                            col.width = 0
                        } 
                        const change = col.grow * widthPerGrow
                        col.width += change;

                        if (change < 0 && col.width <= col.minimumWidth) {
                            // we hit the minimum width, so we need to distribute the width that we couldn't absorb
                            const couldNotAbsorb = col.minimumWidth - col.width
                            distributeWidth -= couldNotAbsorb;
                            col.width = col.minimumWidth;
                        }
                        
                        // Can we absorb the next shrink? (if shrinking)
                        if (!(widthPerGrow < 0 && col.width !== null && col.width <= col.minimumWidth)) {
                            growTotal += col.grow;
                        }

                        col.renderWidth = Math.floor(col.width);
                    }
                }
            }
        } else {
            // shrink or grow all following columns, until the recommended width is reached (when shrinking) and jump to the next one

            for (const column of affectedColumns) {
                if (column.width == null) {
                    continue;
                }

                if (distributeWidth < 0) {
                    if (column.width > column.recommendedWidth) {
                        const shrinkAmount = Math.min(-distributeWidth, column.width - column.recommendedWidth);
                        column.width -= shrinkAmount
                        column.renderWidth = Math.floor(column.width);
                        distributeWidth += shrinkAmount;

                        if (distributeWidth >= 0) {
                            break
                        }
                    }
                } else {
                    column.width += distributeWidth
                    column.renderWidth = Math.floor(column.width);
                    break
                }
            }
        }

        this.updateCanCollapse()
    }

    updateCanCollapse() {
        this.canCollapse = Math.floor(this.totalWidth) > Math.floor((this.$refs["table"] as HTMLElement).clientWidth);
    }

    collapse() {
        this.updateColumnWidth(null, "grow")
    }

    get selectionColumnWidth() {
        return this.showSelection ? 50 : 0
    }

    get totalWidth() {
        const leftPadding = 40
        const rightPadding = 40
        return this.selectionColumnWidth + this.columns.reduce((acc, col) => acc + (col.width ?? 0), 0) + leftPadding + rightPadding
    }

    get totalRenderWidth() {
        const leftPadding = 40
        const rightPadding = 40
        return this.selectionColumnWidth + this.columns.reduce((acc, col) => acc + (col.renderWidth ?? 0), 0) + leftPadding + rightPadding
    }

    get gridTemplateColumns() {
        return this.columns.map(col => `${(col.renderWidth ?? 0)}px`).join(" ")
    }

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

    simulateColumnWidthChange() {
        this.columns[0].width = Math.random() * 400
        this.columns[0].renderWidth = Math.floor(this.columns[0].width)
        this.updateColumnWidth(this.columns[0])
    }

    /**
     * Cached offset between scroll and top of the table
     */
    cachedTableYPosition: number | null = 0

    updateVisibleRows() {
        if (this.sortedValues.length == 0) {
            return
        }

        let topOffset = 0

        if (this.shouldScroll) {
            // Easy case: we can use the table scroll position
            topOffset = (this.$refs["table"] as HTMLElement).scrollTop
        } else {
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

.table-column-content-style {
    font-size: 16px;
}

.table-with-columns {
    margin: 0 calc(-1 * var(--st-horizontal-padding, 40px));
    margin-bottom: calc(-1 * var(--st-vertical-padding, 40px));
    padding-bottom: var(--st-vertical-padding, 40px);
    overflow: hidden;

    .inner-size {
        // This container determines the horizontal width and height.
        // And this should always be fixed for efficient layout calculations.
        // Why required? For the horizontal + vertical scrolling to work properly.

        contain: layout;
        // position: absolute;
        // width: 150%;
        // height: 100%;
    }

    &.scroll {
        overflow: auto;
        flex-grow: 1;
        position: relative;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;

        .inner-size {
            // Should be absolute because the size of the parent should not be affected by the size
            // of the child.
            position: absolute;
        }
    }

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
            top: 0;
            display: flex;
            flex-wrap: nowrap;
            justify-content: center;
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
        }
    }

    &:not(.wrap) {
        .table-head, .table-row {
            .columns {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
                align-items: center;

                 will-change: grid-template-columns;

                

                /*display: flex;
                flex-wrap: nowrap;
                justify-content: flex-start;
                align-items: center;*/

                /*> div {
                    flex-shrink: 0;
                    flex-basis: 0;
                    min-width: 0;
                }*/
            }
        }
    }

    &.wrap {
        padding-top: 20px;

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
        height: 70px;
        border-bottom: 2px solid $color-border;
        position: sticky;
        top: 0px;
        z-index: 100;
        background: var(--color-current-background, #{$color-background} );
        padding-top: 20px;

        .selection-column {
            // Fix height
            padding-top: 20px;
        }

        .columns > div {
            @extend .style-table-head;
            
            user-select: none;

            display: flex;
            flex-direction: row;
            align-items: center;
            padding-right: 20px;

            span:first-child {
                cursor: pointer;
                touch-action: manipulation;
                -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;

                &:active {
                    opacity: 0.6;
                }
            }

            span {
                vertical-align: middle;
                min-width: 0;
            }

            .icon {
                flex-shrink: 0;
            }

            .icon.collapse-left {
                margin-left: auto;
            }

            .drag-handle-container {
                width: 2px;
                height: 20px;
                display: inline-block;
                margin-left: auto;
                position: relative;
                padding-left: 20px;
                flex-shrink: 0;

                &:before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 20px;
                    width: 2px;
                    height: 20px;
                    background: $color-border;
                    border-radius: 2px;
                }

                // The drag area
                .drag-handle {
                    content: '';
                    position: absolute;
                    top: -10px;
                    left: 19px;
                    bottom: -20px;
                    right: -1px;
                    cursor: col-resize;
                    touch-action: pan-x;
                    z-index: 1;
                    background: rgb(0, 89, 255);
                    opacity: 0;
                    transition: opacity 0.2s;
                    border-radius: 2px;

                    &.reached-minimum {
                        cursor: e-resize;
                    }

                    &:hover {
                        opacity: 1;
                        transition: opacity 0.2s 0.6s;
                    }

                    &:active {
                         opacity: 1;
                        transition: opacity 0.1s 0s;
                    }
                }
            }
            

            &:last-child {
                padding-right: 0;
            }
        }
    }

    .table-row {
        contain: layout;
        position: absolute;
        will-change: transform;

        .columns {
            border-bottom: 2px solid $color-border;

            > div {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                will-change: contents, width;
            }
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
