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
                    <div v-for="row of visibleRows" :key="row.id" class="table-row" :style="{ transform: 'translateY('+row.y+'px)', height: rowHeight+'px' }">
                        <div v-for="column of columns" :key="column.id">
                            {{ column.getValue(row.value) }}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>
</template>


<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STNavigationBar } from "@stamhoofd/components"
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
    /// Null is still loading the value
    value: TestValue | null = null

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
    row: Row
}

@Component({
    components: {
        STNavigationBar
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
    loadedRows: Row[] = []

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

    updateVisibleRows() {
        if (this.values.length == 0) {
            return
        }

        const tableBody = this.$refs["tableBody"] as HTMLElement
        const rect = tableBody.getBoundingClientRect();

        let topOffset = 0

        if (rect.top >= 0) {
            // The table is not yet scrolled
            // topOffset = 0
        } else {
            topOffset = -rect.top
        }

        const extraItems = 5

        const firstVisibleItemIndex = Math.max(0, Math.min(Math.floor(topOffset / this.rowHeight) - extraItems, this.values.length - 1))

        const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)

        const lastVisibleItemIndex = Math.max(0, Math.min(Math.floor((topOffset + vh) / this.rowHeight) + extraItems, this.values.length - 1))

        const neededCount = lastVisibleItemIndex - firstVisibleItemIndex + 1



        const cell = this.visibleRows.length > 0 ? this.visibleRows[0] : new CachedRow()
        cell.value = this.values[firstVisibleItem]
        cell.y = firstVisibleItem * this.rowHeight

        if (this.visibleRows.length == 0) {
            this.visibleRows.push(cell)
        }
    }

    get rowHeight() {
        return 40
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
    }

    .table-row, .table-head {
        width: 100%;
        height: 40px;
        border-bottom: 1px solid gray;
        box-sizing: border-box;

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
    }
}
</style>
