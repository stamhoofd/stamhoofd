<template>
    <div class="st-view group-members-view background">
        <STNavigationBar :sticky="false">
            <template #left>
                <BackButton v-if="canPop" slot="left" @click="pop" />
            </template>
            <template #right>
                Buttons todo
            </template>
        </STNavigationBar>
    
        <main>
            <h1>Table</h1>

            <div class="table-with-columns">
                <div class="table-head">
                    <div v-for="column of columns" :key="column.id">
                        {{ column.name }}
                    </div>
                </div>

                <div ref="tableBody" class="table-body" :style="{ height: totalHeight+'px'}">
                    <div v-for="row of visibleRows" :key="row.id" class="table-row" :style="{ transform: 'translateY('+row.y+'px)', height: rowHeight+'px', visibility: row.row === null ? 'hidden' : 'visible' }">
                        <div v-for="column of columns" :key="column.id">
                            <span v-if="row.row && !row.row.value" class="placeholder-skeleton" />
                            <span v-else>
                                {{ row.row && row.row.value ? column.getValue(row.row.value) : "" }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>
</template>


<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, STNavigationBar } from "@stamhoofd/components"
import { sleep } from "@stamhoofd/networking";
import { v4 as uuidv4 } from "uuid";
import { Component, Mixins, Vue } from "vue-property-decorator";

class TestValue {
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
}

class Row {
    /// Null means it is still loading the value
    value: TestValue | null = null

    /**
     * The index in the table, if we know this
     */
    knownIndex = -1

    selected = false
    cachedRow?: CachedRow
}

class Column<T> {
    name: string
    getValue: (val: T) => string

    constructor(name: string, getValue: (val: T) => string) {
        this.name = name
        this.getValue = getValue
    }

    get id() {
        return this.name
    }
}

class CachedRow {
    id = uuidv4()
    y = 0

    /**
     * If row is not set, this means that it can be reused again + that it shouldn't get rendered
     */
    row: Row | null = null

}

@Component({
    components: {
        STNavigationBar,
        BackButton
    },
})
export default class TableView extends Mixins(NavigationMixin) {
    pageSize = 20

    // For testing only
    values: TestValue[] = []

    columns: Column<TestValue>[] = [
        new Column("Naam", (v) => v.name),
        new Column("Leeftijd", (v) => v.age+" jaar"),
        new Column("Status", (v) => v.status)
    ]

    visibleRows: CachedRow[] = []

    // When the system detects that we need to load more rows, we'll fill this array
    // This is the memory buffer. We'll clear it if it gets too big
    loadedRows = new Map<number, Row>()

    // Total amount of values we know we have.
    totalValues = 0

    mounted() {
        // Initialise visible Rows

        for (let index = 0; index < 5000; index++) {
            this.values.push(new TestValue(uuidv4(), "Lid "+index, Math.floor(Math.random() * 99), uuidv4()));
        }

        this.totalValues = this.values.length

        this.updateVisibleRows();

        document.addEventListener("scroll", () => {
            this.updateVisibleRows()
        }, { passive: true })
    }

    // Placeholder function, should get moved outside of the table implementation
    async fetchValues(startIndex: number, previousValue: TestValue, amount = 20) {
        await sleep(200)
        return this.values.slice(startIndex, startIndex + amount)
    }

    loadIfNeeded(startIndex: number, previousValue: TestValue, amount = 20) {
        // Check if we need to load

        // Load them
    }

    getScrollElement(element: HTMLElement | null = null): HTMLElement {
        if (!element) {
            element = this.$el as HTMLElement;
        }

        const style = window.getComputedStyle(element);
        if (style.overflowY == "scroll" || style.overflow == "scroll" || style.overflow == "auto" || style.overflowY == "auto") {
            return element;
        } else {
            if (!element.parentElement) {
                return document.documentElement;
            }
            return this.getScrollElement(element.parentElement);
        }
    }

    /**
     * Cached offset between scroll and top of the table
     */
    cachedTableYPosition: number | null = 0

    updateVisibleRows() {
        if (this.values.length == 0) {
            return
        }

        const scrollElement = document.documentElement; //this.getScrollElement()

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

        const firstVisibleItemIndex = Math.max(0, Math.min(Math.floor(topOffset / this.rowHeight) - extraItems, this.totalValues - 1))

        const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)

        const lastVisibleItemIndex = Math.max(0, Math.min(Math.floor((topOffset + vh) / this.rowHeight) + extraItems, this.totalValues - 1))

        //const neededCount = lastVisibleItemIndex - firstVisibleItemIndex + 1

        // Make all visible rows available if not visible any longer
        for (const cachedRow of this.visibleRows) {
            if (cachedRow.row && (cachedRow.row.knownIndex < firstVisibleItemIndex || cachedRow.row.knownIndex > lastVisibleItemIndex)) {
                //console.log("Freed cachedRow at index "+cachedRow.row.knownIndex)
                cachedRow.row = null
            }
        }

        for (let index = firstVisibleItemIndex; index <= lastVisibleItemIndex; index++) {
            // Is this already visible?
            let cachedRow = this.visibleRows.find(r => r.row?.knownIndex === index)
            if (cachedRow) {
                // Nothing to do, it's already visible
                continue
            }

            //console.log("Row at index "+index+" is not yet loaded. Searching for a spot...")
            cachedRow = this.visibleRows.find(r => r.row === null)

            if (!cachedRow) {
                //console.log("Created new cached row for index "+index)
                cachedRow = new CachedRow()
                this.visibleRows.push(cachedRow)
            }

            // todo: simulate loading here
            const loadedRow = this.loadedRows.get(index)
            let row = loadedRow
            if (!row) {
                row = new Row()
                row.value = this.values[index]

                // In the future, we'll load a value here instead
                // row.value = this.values[index]
                this.loadedRows.set(index, row)

                //console.log("Start loading row at index "+index)
                /*setTimeout(() => {
                    console.log("Loaded row at index "+index)
                    row!.value = this.values[index]
                }, 1000)*/
            }

            row.knownIndex = index
            row.cachedRow = cachedRow
            cachedRow.row = row
            this.values[index]
            cachedRow.y = index * this.rowHeight
            
        }

        //console.log("Rendered rows: "+this.visibleRows.length)
    }

    get rowHeight() {
        return 60
    }

    get totalHeight() {
        return this.rowHeight * this.values.length
    }
}
</script>

<style lang="scss">
@use '~@stamhoofd/scss/base/variables' as *;
@use '~@stamhoofd/scss/base/text-styles' as *;

.table-with-columns {
    contain: layout;

    .table-body {
        contain: layout;
        position: relative;
        overflow: hidden;
    }

    .table-row, .table-head {
        width: 100%;
        height: 60px;
        border-bottom: 2px solid $color-border;
        box-sizing: border-box;
        overflow: hidden;

        display: flex;
        flex-wrap: nowrap;
        justify-content: stretch;
        align-items: center;

        > div {
            flex-shrink: 1;
            flex-grow: 1;
        }
    }

    .table-row {
        contain: layout;
        position: absolute;
        will-change: transform;

        .placeholder-skeleton {
            display: block;
            height: 1em;
            width: 150px;
            border-radius: 5px;
            background: $color-background-shade-darker;
        }
    }
}
</style>
