<template>
    <div class="modern st-view table-view background">
        <STNavigationBar :add-shadow="wrapColumns" :title="title">
            <template #left>
                <button v-if="canLeaveSelectionMode && isMobile && showSelection && !isIOS" type="button" class="button icon navigation close" @click="setShowSelection(false)" />
                <button v-else-if="canLeaveSelectionMode && showSelection && isIOS" type="button" class="button navigation" @click="setSelectAll(!isAllSelected)">
                    <template v-if="isAllSelected">
                        Deselecteer alles
                    </template>
                    <template v-else>
                        Selecteer alles
                    </template>
                </button>
                <BackButton v-else-if="canPop" slot="left" @click="pop">
                    {{ backHint || 'Terug' }}
                </BackButton>
            </template>
            <template #right>
                <template v-if="!isIOS || !isMobile">
                    <button v-for="(action, index) of filteredActions" :key="index" v-tooltip="action.tooltip" type="button" :class="'button icon navigation '+action.icon" :disabled="action.needsSelection && ((showSelection && isMobile) || !action.allowAutoSelectAll) && !hasSelection" @click="handleAction(action, $event)" />
                </template>

                <template v-if="showSelection && isIOS && canLeaveSelectionMode">
                    <button v-if="canLeaveSelectionMode" key="iOSDone" type="button" class="button navigation highlight" @click="setShowSelection(false)">
                        Gereed
                    </button>
                </template>
                <button v-else-if="!showSelection && isIOS" key="iOSSelect" type="button" class="button navigation" @click="setShowSelection(true)">
                    Selecteer
                </button>
                <button v-else key="actions" type="button" class="button icon more navigation" @click.prevent="showActions(true, $event)" @contextmenu.prevent="showActions(true, $event)" />
            </template>
        </STNavigationBar>

        <main>
            <div class="container">
                <h1 class="style-navigation-title">
                    {{ title }}
                    <span v-if="suffix" class="title-suffix">
                        {{ suffix }}
                    </span>
                </h1>
                <slot />

                <div class="input-with-buttons">
                    <div>
                        <form class="input-icon-container icon search gray" @submit.prevent="blurFocus">
                            <input v-model="searchQuery" class="input" name="search" placeholder="Zoeken" type="search" inputmode="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off" @input="searchQuery = $event.target.value">
                        </form>
                    </div>
                    <div v-if="canFilter">
                        <button type="button" class="button text" @click="editFilter">
                            <span class="icon filter" />
                            <span class="hide-small">Filter</span>
                            <span v-if="hiddenItemsCount > 0" class="bubble primary">{{ filteredText }}</span>
                        </button>
                    </div>
                </div>
            </div>

            <div ref="table" class="table-with-columns" :class="{ wrap: wrapColumns, 'show-checkbox': showSelection, 'show-prefix': showPrefix }">
                <div class="inner-size" :style="!wrapColumns ? { height: (totalHeight+50)+'px', width: totalRenderWidth+'px'} : {}">
                    <div class="table-head" @contextmenu.prevent="onTableHeadRightClick($event)">
                        <div v-if="showSelection" class="selection-column">
                            <Checkbox :checked="isAllSelected" @change="setSelectAll($event)" />
                        </div>

                        <div class="columns">
                            <div v-for="(column, index) of columns" :key="column.id" :class="{isDragging: isDraggingColumn === column && isColumnDragActive && dragType === 'order'}" :data-align="column.align">
                                <button type="button" @mouseup.left="toggleSort(column)" @mousedown.left="columnDragStart($event, column)" @touchstart="columnDragStart($event, column)">
                                    <span>{{ column.name }}</span>

                                    <span
                                        v-if="sortBy === column"
                                        class="sort-arrow icon"
                                        :class="{
                                            'arrow-up-small': sortDirection == 'ASC',
                                            'arrow-down-small': sortDirection == 'DESC',
                                        }"
                                    />
                                </button>
                                <span v-if="index < columns.length - 1" class="drag-handle-container"><span class="drag-handle" @mousedown="handleDragStart($event, column)" @touchstart="handleDragStart($event, column)" /></span>
                                <button v-else-if="canCollapse" v-tooltip="'Pas kolommen op het scherm'" type="button" class="button light-gray icon collapse-left" @click="collapse" />
                            </div>
                        </div>
                    </div>

                    <div ref="tableBody" class="table-body" :style="{ height: totalHeight+'px' }">
                        <div v-for="row of visibleRows" :key="row.id" v-long-press="(e) => onRightClickRow(row, e)" class="table-row" :style="{ transform: 'translateY('+row.y+'px)', display: row.currentIndex === null ? 'none' : '' }" @click="onClickRow(row)" @contextmenu.prevent="onRightClickRow(row, $event)">
                            <label v-if="showSelection" class="selection-column" @click.stop>
                                <Checkbox v-if="row.value" :key="row.value.id" :checked="row.cachedSelectionValue" @change="setSelectionValue(row, $event)" />
                                <Checkbox v-else :checked="false" />
                            </label>
                            <div v-if="showPrefix" class="prefix-column" :data-style="prefixColumn.getStyleFor(row.value, true)" :data-align="prefixColumn.align">
                                <span v-if="row.value" v-text="prefixColumn.getFormattedValue(row.value)" />
                                <span v-else class="placeholder-skeleton" :style="{ width: Math.floor(row.skeletonPercentage*100) + '%'}" />
                            </div>
                            <div class="columns">
                                <div v-for="column of columns" :key="column.id" :class="{isDragging: isDraggingColumn === column && isColumnDragActive && dragType === 'order' }" :data-style="column.getStyleFor(row.value)" :data-align="column.align">
                                    <span v-if="row.value" v-text="column.getFormattedValue(row.value)" />
                                    <span v-else class="placeholder-skeleton" :style="{ width: Math.floor(row.skeletonPercentage*(Math.min(!wrapColumns ? column.width : 200, column.recommendedWidth)-30))+'px'}" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <p v-if="errorMessage" class="error-box with-button">
                {{ errorMessage }}

                <button class="button text" type="button" @click="refresh">
                    Opnieuw
                </button>
            </p>

            <p v-else-if="totalFilteredCount === 0 && totalItemsCount === 0" class="info-box">
                <slot name="empty" />
            </p>
            <p v-else-if="totalFilteredCount === 0" class="info-box with-button">
                Geen resultaten gevonden

                <button class="button text" type="button" @click="resetFilter">
                    Reset
                </button>
            </p>
        </main>

        <STButtonToolbar v-if="isIOS && isMobile">
            <button v-for="(action, index) of filteredActions" :key="index" type="button" class="button text small column selected" :disabled="action.needsSelection && (showSelection || !action.allowAutoSelectAll) && !hasSelection" @click="action.needsSelection && (showSelection || !action.allowAutoSelectAll) && !hasSelection ? undefined : handleAction(action, $event)">
                <span :class="'icon '+action.icon" />
            </button>

            <button v-long-press="(e) => showActions(false, e)" type="button" class="button text small column selected" @click="showActions(false, $event)">
                <span class="icon more" />
            </button>
        </STButtonToolbar>
    </div>
</template>


<script lang="ts">
import { ArrayDecoder, AutoEncoder, BooleanDecoder, Decoder, EnumDecoder, field, NumberDecoder, ObjectData, PlainObject, StringDecoder, VersionBox, VersionBoxDecoder } from "@simonbackx/simple-encoding";
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from "@simonbackx/simple-errors";
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, LongPressDirective, STButtonToolbar, STNavigationBar, Toast, TooltipDirective, UIFilter, UIFilterBuilders } from "@stamhoofd/components";
import { Storage } from "@stamhoofd/networking";
import { SortItemDirection, Version } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { v4 as uuidv4 } from "uuid";
import { Component, Mixins, Prop, Watch } from "vue-property-decorator";

import UIFilterEditor from "../filters/UIFilterEditor.vue";
import { Column } from "./Column";
import ColumnSelectorContextMenu from "./ColumnSelectorContextMenu.vue";
import ColumnSortingContextMenu from "./ColumnSortingContextMenu.vue";
import { TableAction } from "./TableAction";
import TableActionsContextMenu from "./TableActionsContextMenu.vue";
import {FetchAllOptions, TableObjectFetcher} from "./TableObjectFetcher"

interface TableListable {
    id: string;
    matchQuery(query: string): boolean;
}

class VisibleRow<T> {
    id = uuidv4()
    y = 0

    /**
     * currentIndex = null -> available for reause
     */
    currentIndex: null | number = null

    /**
     * value = null -> show loading indicator
     */
    value: T | null = null

    cachedSelectionValue = false

    skeletonPercentage = Math.random() * 0.5 + 0.5
}

class EnabledColumnConfiguration extends AutoEncoder {
    @field({ decoder: StringDecoder })
        id: string

    @field({ decoder: NumberDecoder })
        width: number
}

/**
 * We store this configuration in storage, so we can reuse the previous configuration every time
 */
class ColumnConfiguration extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(EnabledColumnConfiguration) })
        columns: EnabledColumnConfiguration[] = []

    @field({ decoder: BooleanDecoder, optional: true })
        canCollapse = false

    @field({ decoder: StringDecoder, optional: true })
        sortColumnId?: string

    @field({ decoder: new EnumDecoder(SortItemDirection), optional: true })
        sortDirection:  SortItemDirection = SortItemDirection.ASC
}

@Component({
    components: {
        STNavigationBar,
        BackButton,
        Checkbox,
        STButtonToolbar
    },
    directives: {
        tooltip: TooltipDirective,
        longPress: LongPressDirective
    },
    emits: ["click"]
})
export default class ModernTableView<Value extends TableListable> extends Mixins(NavigationMixin) {
    @Prop({ required: true})
        title!: string

    @Prop({ required: false})
        backHint?: string

    @Prop({ default: "" })
        description!: string

    @Prop({ required: false, default: () => [] })
        actions!: TableAction<Value>[]

    @Prop({ required: false, default: 30 })
        estimatedRows!: number

    @Prop({required: true})
        tableObjectFetcher: TableObjectFetcher<Value>

    @Prop({required: false, default: null})
        UIFilterBuilders: UIFilterBuilders|null

    selectedUIFilter: UIFilter | null = null
    searchQuery = ""

    // Where to store the latest column configuration, so we can reload it instead of switching to the defaults each time
    @Prop({ required: true})
        columnConfigurationId!: string

    @Prop({ required: true})
        allColumns!: Column<Value, any>[]

    /**
     * Prefix column in wrapped state
     */
    @Prop({ required: false, default: null })
        prefixColumn!: Column<Value, any> | null

    @Prop({ required: false, default: null })
        defaultSortColumn!: Column<Value, any> | null

    @Prop({ required: false, default: null })
        defaultSortDirection!: SortItemDirection | null

    get showPrefix() {
        return this.prefixColumn !== null && this.wrapColumns && this.prefixColumn.enabled
    }

    get columns() {
        return this.allColumns.filter(c => c.enabled && (!this.showPrefix || c.id !== this.prefixColumn?.id)).sort((a, b) => a.index - b.index)
    }

    get hiddenColumns() {
        return this.allColumns.filter(c => !c.enabled)
    }

    isMobile = window.innerWidth < 600

    get isIOS() {
        return this.$OS === "iOS"
    }

    get suffix() {
        if (this.tableObjectFetcher.totalCount === null) {
            return ''
        }

        return Formatter.integer(this.tableObjectFetcher.totalCount)
    }

    get hiddenItemsCount() {
        if (this.tableObjectFetcher.totalCount ===  null || this.tableObjectFetcher.totalFilteredCount ===  null) {
            return 0;
        }
        return this.tableObjectFetcher.totalCount - this.tableObjectFetcher.totalFilteredCount;
    }

    get filteredText() {
        return this.tableObjectFetcher.totalFilteredCount !== null ? `${this.tableObjectFetcher.totalFilteredCount}` : ''
    }

    wrapColumns = this.isMobile
    showSelection = !this.isMobile

    sortBy: Column<Value, any> = this.defaultSortColumn ?? this.columns[0]
    sortDirection: SortItemDirection = this.defaultSortDirection ?? SortItemDirection.ASC

    visibleRows: VisibleRow<Value>[] = []

    // If the user selects a row, we'll add it in the selectedRows. But if the user selects all rows, 
    // we don't want to add them all, that would be a performance hit. So'ill invert it and only save the unselected values here.
    markedRows = new Map<string, Value>()

    /**
     * When true: only the marked rows are selected.
     * When false: all rows are selected, except the marked rows
     */
    markedRowsAreSelected = true

    // Column drag helpers:
    isDraggingColumn: Column<any, any> | null = null
    draggingStartX = 0
    draggingInitialWidth = 0
    draggingInitialColumns: Column<any, any>[] = []
    isColumnDragActive = false
    dragType: "width" | "order" = "width"

    created() {
        this.onSortChange()
    }

    @Watch("allColumns")
    onUpdateColumns() {
        console.log('update columns')
        this.loadColumnConfiguration().catch(console.error)
        this.updateVisibleRows()
    }

    @Watch("sortBy")
    onSortChange() {
        this.tableObjectFetcher.setSort([
            {
                key: this.sortBy.id,
                order: this.sortDirection
            }
        ])
    }

    @Watch("sortDirection")
    onToggleSortDirection() {
        this.onSortChange()
    }

    @Watch("selectedUIFilter", {deep: true})
    onUIFilterChanged() {
        const filter = this.selectedUIFilter ? this.selectedUIFilter.build() : null;
        this.tableObjectFetcher.setFilter(filter)
    }

    @Watch("searchQuery")
    onSearchQueryChanged() {
        this.tableObjectFetcher.setSearchQuery(this.searchQuery)
    }

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

    get hasClickListener() {
        return !!this.$.vnode.props?.onClick
    }

    blurFocus() {
        (document.activeElement as HTMLElement)?.blur()
    }

    onClickRow(row: VisibleRow<Value>) {
        if (!this.hasClickListener || (this.wrapColumns && this.showSelection)) {
            // On mobile, tapping a column means selecting it when we are in editing modus
            this.setSelectionValue(row, !this.getSelectionValue(row))
            return
        }
        if (this.hasClickListener && row.value) {
            this.$emit("click", row.value)
        }
    }

    onRightClickRow(row: VisibleRow<Value>, event) {
        if (this.isMobile && !this.showSelection && !this.isIOS) {
            // On Android, the default long press action is switching to editing mode
            this.setSelectionValue(row, true)
            this.setShowSelection(true)
            return
        }
        // Show a context menu to select the available columns

        const actions = this.actions.filter(a => a.needsSelection);

        // Also add select all actions
        if (!this.showSelection || row.cachedSelectionValue == false) {
            // Add select action
            actions.push(new TableAction({
                name: "Selecteer",
                groupIndex: !this.showSelection ? -1 : 1,
                priority: 10,
                handler: () => {
                    this.setSelectionValue(row, true)
                    this.setShowSelection(true)
                }
            }))
        } else {
            // Add select action
            actions.push(new TableAction({
                name: "Deselecteer",
                groupIndex: 1,
                priority: 10,
                handler: () => {
                    this.setSelectionValue(row, false)
                }
            }))
        }

        const displayedComponent = new ComponentWithProperties(TableActionsContextMenu, {
            x: event.changedTouches ? event.changedTouches[0].pageX : event.clientX,
            y: event.changedTouches ? event.changedTouches[0].pageY : event.clientY,
            actions,
            selection: {
                isSingle: true,
                hasSelection: true,
                getSelection: () => {
                    return [row.value!]
                }
            }
        });

        this.present(displayedComponent.setDisplayStyle("overlay"));
    }

    setShowSelection(showSelection: boolean) {
        this.showSelection = showSelection
        if (!showSelection) {
            this.setSelectAll(false)
        }
    }

    columnDragStart(event, column: Column<any, any>) {
        // Don't allow drag with right mouse or other buttons
        if (event.button !== undefined && event.button !== 0) {
            return
        }
        if (event.button === 0 && (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)) {
            // Don't allow drag with ctrl+click
            return
        }
        this.draggingStartX = this.getEventX(event);
        this.isDraggingColumn = column
        this.dragType = "order"
        this.draggingInitialColumns = this.columns.slice()
        this.isColumnDragActive = false
        this.attachDragHandlers()
    }

    handleDragStart(event, column: Column<any, any>) {
        // Don't allow drag with right mouse or other buttons
        if (event.button !== undefined && event.button !== 0) {
            return
        }
        if (event.button === 0 && (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)) {
            // Don't allow drag with ctrl+click
            return
        }
        this.draggingStartX = this.getEventX(event);
        this.isDraggingColumn = column
        this.dragType = "width"
        this.draggingInitialWidth = column.width ?? 0
        this.isColumnDragActive = true
        this.attachDragHandlers()
    }

    horizontalPadding = 40

    updatePaddingIfNeeded() {
        if (this.horizontalPadding === 0) {
            this.updatePadding()
        }
    }
    
    updatePadding() {
        const padding = getComputedStyle((this.$refs["table"] as HTMLElement))
            .getPropertyValue('--st-horizontal-padding');

        this.horizontalPadding = parseInt(padding)
    }

    attachDragHandlers() {
        this.updateRecommendedWidths();

        if (this.isColumnDragActive) {
            (this.$refs["table"] as HTMLElement).style.cursor = this.dragType === "width" ? "col-resize" : "grabbing"
        }
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

        this.saveColumnConfiguration()
    }

    mouseMove(event) {
        if (!this.isDraggingColumn) {
            return
        }
        const currentX = this.getEventX(event)
        const difference = currentX - this.draggingStartX

        if (!this.isColumnDragActive) {
            if (Math.abs(difference) > 5) {
                this.isColumnDragActive = true;
                (this.$refs["table"] as HTMLElement).style.cursor = this.dragType === "width" ? "col-resize" : "grabbing"
            } else {
                return
            }
        }

        if (this.dragType === "width") {
            const currentWidth = this.totalWidth

            const newWidth = this.draggingInitialWidth + difference
            this.isDraggingColumn.width =  Math.max(newWidth, this.isDraggingColumn.minimumWidth)
            this.isDraggingColumn.renderWidth = Math.floor(this.isDraggingColumn.width)

            this.updateColumnWidth(this.isDraggingColumn, "move", currentWidth)
        } else {
            // We swap columns if the startX of the column moves over the middle of a different column            
            // Calculate how many columns we have moved in the X direction 
            let startIndex = this.draggingInitialColumns.findIndex(c => c === this.isDraggingColumn)
            let columnMoveIndex = 0
            let remainingDifference = difference
            while (Math.sign(remainingDifference) === Math.sign(difference)) {
                let shouldMove = (remainingDifference < 0) ? -1 : 1
                const column = this.draggingInitialColumns[startIndex + shouldMove + columnMoveIndex]
                if (!column || column.width === null) {
                    break
                }
                // Move the column if they overlap at least 50%
                const neededMove = column.width / 2
                if (Math.abs(remainingDifference) > neededMove) {
                    remainingDifference -= column.width*shouldMove
                    columnMoveIndex += shouldMove
                } else {
                    break
                }
            }

            const columns = this.draggingInitialColumns.slice()
            columns.splice(startIndex, 1);
            columns.splice(startIndex + columnMoveIndex, 0, this.isDraggingColumn);

            // Update indexes
            for (let i = 0; i < columns.length; i++) {
                columns[i].index = i
            }

            // Translate moving column with mouse
            (this.$refs["table"] as HTMLElement).style.setProperty("--drag-x", `${remainingDifference}px`);

        }

        // Prevent scrolling (on mobile) and other stuff
        event.preventDefault();
        return false;
    }

    mouseUp(_event) {
        if (this.isDraggingColumn) {
            this.detachDragHandlers();
            this.isDraggingColumn = null;
        }
        this.isColumnDragActive = false
    }

    mounted() {
        this.loadColumnConfiguration().catch(console.error)
        this.getScrollElement(this.$refs["table"] as HTMLElement).addEventListener("scroll", this.onScroll, { passive: true })

        if (!this.canLeaveSelectionMode) {
            this.showSelection = true
        }

        this.refreshOnReturn()
    }

    activated() {
        if (!this.wrapColumns) {
            window.addEventListener("resize", this.onResize, { passive: true })
            this.onResize()
        }
    }

    deactivated() {
        // Better to remove event resize listener, because on resize, we don't need to rerender the table
        window.removeEventListener("resize", this.onResize)
    }

    beforeUnmount() {
        // Remove event listeners
        this.getScrollElement(this.$refs["table"] as HTMLElement).removeEventListener("scroll", this.onScroll)
        window.removeEventListener("resize", this.onResize)
        document.removeEventListener("visibilitychange", this.doRefresh)
        this.tableObjectFetcher.destroy();
    }

    lastRefresh = new Date()

    refreshOnReturn() {
        document.addEventListener("visibilitychange", this.doRefresh);
    }

    refresh() {
        this.lastRefresh = new Date()
        this.tableObjectFetcher.reset()
    }

    doRefresh() {
        if (document.visibilityState === 'visible') {
            console.info("Window became visible again")
            this.refresh()
        }
    }

    get canLeaveSelectionMode() {
        return this.wrapColumns || !this.hasClickListener
    }

    ticking = false

    onScroll() {
        if (!this.ticking) {
            window.requestAnimationFrame(() => {
                this.updateVisibleRows()
                this.ticking = false;
            });

            this.ticking = true;
        }
    }

    onResize() {
        // Force padding update
        this.updatePadding()

        if (this.canCollapse) {
        // Keep existing width
            this.updateCanCollapse()
        } else {
        // shrink or grow width
            this.updateColumnWidth()
        }
        this.updateVisibleRows()
    }

    async loadColumnConfiguration() {
        try {
            const json = await Storage.keyValue.getItem("column-configuration-"+this.columnConfigurationId)
            if (json !== null) {
                const parsed = new ObjectData(JSON.parse(json), { version: Version })
                const decoded = (new VersionBoxDecoder(ColumnConfiguration as Decoder<ColumnConfiguration>).decode(parsed)).data

                for (const col of this.allColumns) {
                    const i = decoded.columns.findIndex(c => c.id === col.id)
                    if (i === -1) {
                        col.enabled = false
                    } else {
                        const config = decoded.columns[i]
                        col.enabled = true
                        col.width = config.width
                        col.renderWidth = Math.floor(col.width)
                        col.index = i
                    }
                }

                if (decoded.sortColumnId) {
                    const sortBy = this.allColumns.find(c => c.id === decoded.sortColumnId)
                    if (sortBy) {
                        this.sortBy = sortBy
                        this.sortDirection = decoded.sortDirection ?? SortItemDirection.ASC
                    }
                }

                this.updateRowHeight()
                this.updateVisibleRows();
                this.updateRecommendedWidths();

                if (decoded.canCollapse) {
                    this.updateCanCollapse()
                } else {
                    this.updateColumnWidth()
                }
            } else {
                this.updateRowHeight()
                this.updateVisibleRows();
                this.updateRecommendedWidths();
                this.updateColumnWidth()
            }
        } catch (error) {
            console.error(error)
        }
        
    }

    @Watch("wrapColumns")
    onWrapChanged() {
        this.updateRowHeight()
        this.updateVisibleRows()
    }

    @Watch("columns")
    onColumnsChanged() {
        this.updateRowHeight()
        this.updateVisibleRows()

        if (this.canCollapse) {
            // Update width of new columns, without adjusting the width of any column
            this.fixColumnWidths(this.columns)
            this.updateCanCollapse()

            if (!this.canCollapse) {
                // Redistribute
                this.updateColumnWidth()
            }
        } else {
            this.updateColumnWidth()
        }
        this.saveColumnConfiguration()
    }

    saveColumnConfiguration() {
        const configuration = ColumnConfiguration.create({
            // We also need to saveh  te prefix column
            columns: [...this.columns, ...(this.showPrefix ? [this.prefixColumn!] : [])].map(c => EnabledColumnConfiguration.create({ id: c.id, width: c.width ?? 0 })),
            canCollapse: this.canCollapse,
            sortColumnId: this.sortBy.id,
            sortDirection: this.sortDirection,
        })

        const versionBox = new VersionBox(configuration)
        const json = JSON.stringify(versionBox.encode({ version: Version }))
        Storage.keyValue.setItem("column-configuration-"+this.columnConfigurationId, json).catch(console.error)
    }

    onTableHeadRightClick(event) {
        // Show a context menu to select the available columns
        const displayedComponent = this.getColumnContextMenu();
        displayedComponent.properties.x = event.clientX
        displayedComponent.properties.y = event.clientY
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }

    getColumnContextMenu() {
        return new ComponentWithProperties(ColumnSelectorContextMenu, {
            columns: this.allColumns,
        })
    }

    getSortingContextMenu() {
        return new ComponentWithProperties(ColumnSortingContextMenu, {
            columns: this.allColumns,
            table: this
        })
    }

    /**
     * Loop all visible rows, and sets the recommended width of each column to the maximum width of the column.
     */
    updateRecommendedWidths() {
        //console.log("Update recommended width")
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
            let found = false

            for (const visibleRow of this.visibleRows) {
                const value = visibleRow.value

                if (!value) {
                    continue
                }
                found = true

                const text = column.getFormattedValue(value)
                

                measureDiv.innerText = text
                const width = measureDiv.clientWidth
                if (width > maximum) {
                    maximum = width
                }
            }

            // Also add some padding
            if (found) {
                column.recommendedWidth = maximum + 15;
                // console.log("Updated recommend width of column " + column.name + " to " + (maximum + 15), column.minimumWidth)
            }

        }

        document.body.removeChild(measureDiv)
    }

    canCollapse = false

    fixColumnWidths(columns: Column<any, any>[]) {
        // First fix columns without width and update distributeWidth accordongly, because this can change the sign whether we need to grow or shrink the other columns
        // Also update columns that are smaller than the minimumWidth
        let distributeWidth = 0
        for (const col of columns) {
            if (col.renderWidth === null && col.width !== null) {
                col.renderWidth = Math.floor(col.width);
            }
            if (col.width === null || col.width === 0) {
                col.width = col.recommendedWidth
                distributeWidth -= col.recommendedWidth
                col.renderWidth = Math.floor(col.width);
            }

            if (col.width < col.minimumWidth) {
                distributeWidth -= col.minimumWidth - col.width
                col.width = col.minimumWidth
                col.renderWidth = Math.floor(col.width);
            }
        }
        return distributeWidth
    }

    /**
     * Update the width of the columns by distributing the available width across the columns, except the ignored column (optional)
     */
    updateColumnWidth(afterColumn: Column<any, any> | null = null, strategy: "grow" | "move" = "grow", forceWidth: number | null = null) {
        this.updatePaddingIfNeeded()
        // console.log("Update column width")
        
        if (this.wrapColumns) {
            return
        }
        
        const leftPadding = this.horizontalPadding
        const rightPadding = this.horizontalPadding

        const availableWidth = (forceWidth ?? (this.$refs["table"] as HTMLElement).clientWidth) - this.selectionColumnWidth - leftPadding - rightPadding;

        if (isNaN(availableWidth) || availableWidth <= 0) {
            console.warn("Available width is NaN or <= 0")
            return
        }
        const currentWidth = this.columns.reduce((acc, col) => acc + (col.width ?? 0), 0);
        let distributeWidth = availableWidth - currentWidth;

        const affectedColumns = afterColumn ? this.columns.slice(this.columns.findIndex(c => c === afterColumn ) + 1) : this.columns
        
        // First fix columns without width and update distributeWidth accordongly, because this can change the sign whether we need to grow or shrink the other columns
        // Also update columns that are smaller than the minimumWidth
        distributeWidth += this.fixColumnWidths(affectedColumns)

        if (strategy === "grow") {

            // Get columns with the highest priority for shrinking or growing
            // growing: the ones with a width lower than the recommendedWidth
            // shrinking: the ones with a width higher than the recommendedWidth

            const shrinking = distributeWidth < 0

            const columnPriorities: ((col: Column<any, any>) => boolean)[] = shrinking ? [
                // First, shrink all the columns that are larger than the recommendedWidth
                (c) => c.width !== null && c.width > c.recommendedWidth,

                // At last, only shrink columns larger than the minimum width
                (c) => c.width !== null && c.width > c.minimumWidth
            ] : [
                // First grow all the columns that are smaller than the recommendedWidth
                (c) => c.width !== null && c.width < c.minimumWidth,
                (c) => c.width !== null && c.width < c.recommendedWidth,

                // Grow only columns that have grow = true (unless none of the columns have grow = true, in which case this step is skipped automatically)
                (c) => c.width !== null && c.grow === true,

                // At last, grow any column, exept when they don't have width yet
                (c) => c.width !== null
            ]

            const columnLimits: {minimum?: (col: Column<any, any>) => number, maximum?: (col: Column<any, any>) => number}[] = shrinking ? [
                { minimum: c => c.recommendedWidth },
                { minimum: c => c.minimumWidth },
            ] : [
                { maximum: c => c.minimumWidth }, // Grow to recommended size and continue to next step
                { maximum: c => c.recommendedWidth }, // Grow to recommended size and continue to next step
                { },
                { },
            ]
            
            let columnPriorityIndex = 0

            let columns = affectedColumns // use same type, and don't allocate a new array because we'll override it shortly

            //console.log("Current column configuration", columns.map(c => c.name+" ("+c.renderWidth+")"))

            const updateColumns = () => {
                columns = affectedColumns.filter(c => columnPriorities[columnPriorityIndex](c))
            }
            updateColumns()

            while (distributeWidth !== 0 && (columns.length > 0 || columnPriorityIndex < columnPriorities.length - 1)) {
                if (columns.length == 0) {
                    columnPriorityIndex++
                    
                    updateColumns()
                    // console.log("Moving to columnPriorityIndex", columnPriorityIndex)
                    // console.log("Current column configuration", columns.map(c => c.name+" ("+c.renderWidth+")"))

                    // Check loop conditions again, and if needed, jump to the next priority or start distributing
                    continue
                }

                // Always try to grow with rounded numbers, because else we'll get rounding errors
                let change = Math.round(distributeWidth / columns.length);

                if (Math.abs(change) < 1) {
                    // Make sure change is never zero, or we'll have an infinite loop
                    change = Math.sign(distributeWidth)
                }

                // console.log("Distributing columns ", change, "px", "of", distributeWidth, "px")
                
                // We'll make sure we never grow or shrink more than the distribute width

                for (let col of columns) {
                    if (col.width == null) {
                        throw new Error("Impossible. Typescript type checking error")
                    } 

                    const start = col.width

                    if ((shrinking && change < distributeWidth) || (!shrinking && change > distributeWidth)) {
                        // Prevent growing more than the distributeWidth
                        //console.log("Limited change to distributeWidth", change, distributeWidth)
                        change = distributeWidth
                    }

                    col.width += change;
                    
                    // A column can never shrink more than its recommended width, or it's start width, if that was already smaller (only in case of minimum)
                    const limits = columnLimits[columnPriorityIndex]
                    
                    const min = limits.minimum ? Math.min(start, limits.minimum(col)) : undefined
                    const max = limits.maximum ? Math.max(start, limits.maximum(col)) : undefined

                    if (min !== undefined && col.width <= min) {
                        // we hit the minimum width, so we need to distribute the width that we couldn't absorb
                        col.width = min;
                        //console.log("Column", col.name, "absorbed", absorbed, "of", change, "and is now at it's minimum", col.width)
                    } else if (max !== undefined && col.width >= max) {
                        // we hit the minimum width, so we need to distribute the width that we couldn't absorb
                        col.width = max;
                        //
                    }

                    const absorbed = col.width - start;
                    distributeWidth -= absorbed;
                    //console.log("Column", col.name, "absorbed", absorbed, "of", change, "and is now at ", col.width)
                    col.renderWidth = Math.floor(col.width);
                }

                // Update columns
                updateColumns()
            }

            //console.log("Done distributing with distributeWidth left: ", distributeWidth)
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
        this.updatePaddingIfNeeded()

        if (this.wrapColumns) {
            return
        }
        const n = this.canCollapse
        this.canCollapse = Math.floor(this.totalWidth) > Math.floor((this.$refs["table"] as HTMLElement).clientWidth);

        if (n !== this.canCollapse) {
            this.saveColumnConfiguration()
        }
    }

    collapse() {
        this.updateColumnWidth(null, "grow")
        this.saveColumnConfiguration()
    }

    get selectionColumnWidth() {
        return this.showSelection ? (this.wrapColumns ? 40 : 50) : 0
    }

    get totalWidth() {
        const leftPadding = this.horizontalPadding
        const rightPadding = this.horizontalPadding
        return this.selectionColumnWidth + this.columns.reduce((acc, col) => acc + (col.width ?? 0), 0) + leftPadding + rightPadding
    }

    get totalRenderWidth() {
        const leftPadding = this.horizontalPadding
        const rightPadding = this.horizontalPadding
        return this.selectionColumnWidth + this.columns.reduce((acc, col) => acc + (col.renderWidth ?? 0), 0) + leftPadding + rightPadding
    }

    get gridTemplateColumns() {
        return this.columns.map(col => `${(col.renderWidth ?? 0)}px`).join(" ")
    }

    @Watch("gridTemplateColumns")
    updateGridSize(val: string) {
        if (!this.wrapColumns) {
            (this.$refs["table"] as HTMLElement).style.setProperty("--table-columns", val);
        }
    }

    resetFilter() {
        this.searchQuery = ""
        this.selectedUIFilter = null
    }

    /**
     * @deprecated
     */
    get filteredValues() {
        return this.values
    }

    get sortedActions() {
        return this.actions.slice().sort((a,b) => b.priority - a.priority)
    }

    get filteredActions() {
        if (!this.isMobile || !this.showSelection) {
            return this.sortedActions.filter(action => action.enabled && !action.singleSelection).slice(0, 3)
        }

        return this.sortedActions.filter(action => {
            return action.enabled && action.needsSelection && !action.singleSelection
        }).slice(0, 3)
    }

    get canFilter() {
        return !!this.UIFilterBuilders
    }

    editFilter() {
        if (!this.UIFilterBuilders) {
            return
        }
        const filter = this.selectedUIFilter ?? this.UIFilterBuilders[0].create()
        if (!this.selectedUIFilter) {
            this.selectedUIFilter = filter;
        }

        this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(UIFilterEditor, {
                        filter
                    })
                })
            ],
            modalDisplayStyle: 'popup',
            modalClass: 'filter-sheet'
        })
    }

    get values() {
        return this.tableObjectFetcher.objects
    }

    /**
     * @deprecated
     */
    get sortedValues() {
        return this.values
    }

    toggleSort(column: Column<any, any>) {
        if (this.isColumnDragActive) {
            //console.log("Ignored sort toggle due to drag")
            return
        }
        if (this.sortBy === column) {
            if (this.sortDirection === SortItemDirection.ASC) {
                this.sortDirection = SortItemDirection.DESC;
            } else {
                this.sortDirection = SortItemDirection.ASC;
            }
        } else {
            this.sortBy = column;
        }
        this.saveColumnConfiguration()
    }

    isValueSelected(value: Value) {
        const found = this.markedRows.has(value.id)

        if (this.markedRowsAreSelected) {
            return found
        } else {
            return !found
        }
    }

    getSelectionValue(row: VisibleRow<Value>) {
        const value = row.value
        if (!value) {
            return false
        }

        return this.isValueSelected(value)
    }

    setSelectionValues(values: Value[], selected: boolean) {
        for (const value of values) {
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

            // Update cached value of visible row
            const row = this.visibleRows.find(r => r.value?.id === value.id)
            if (row) {
                row.cachedSelectionValue = selected
            }
        }

        // Update cached all selection
        this.updateHasSelection()
    }

    setSelectionValue(row: VisibleRow<Value>, selected: boolean) {
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
        this.updateHasSelection()
    }

    isAllSelected = false
    hasSelection = false;
    hasSingleSelection = false;

    /**
     * Cached because of usage of maps which are not reactive
     */
    updateHasSelection() {
        this.hasSelection = this.markedRowsAreSelected ? this.markedRows.size > 0 : (((this.tableObjectFetcher.totalFilteredCount ?? this.values.length) - this.markedRows.size) > 0)
        this.isAllSelected = this.getSelectAll()
        this.hasSingleSelection = this.markedRowsAreSelected && this.markedRows.size === 1
    }

    /**
     * This is not reactive, due to the use of maps, which are not reactive in vue.
     * Thats why we need a cached value.
     */
    getSelectAll(): boolean {
        if (this.markedRowsAreSelected) {
            return this.markedRows.size === (this.tableObjectFetcher.totalFilteredCount ?? this.values.length)
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
        this.updateHasSelection()
    }

    async getSelection(options?: FetchAllOptions): Promise<Value[]> {
        if (!this.showSelection || !this.hasSelection) {
            return await this.tableObjectFetcher.fetchAll(options)
        }

        // TODO: fix sorting

        if (this.markedRowsAreSelected) {
            // No async needed
            return Array.from(this.markedRows.values())
        } else {
            const all = await this.tableObjectFetcher.fetchAll(options);
            return Array.from(all).filter(val => !this.markedRows.has(val.id))
        }
    }

    getExpectedSelectionLength(): number {
        if (!this.showSelection || !this.hasSelection) {
            return this.tableObjectFetcher.totalFilteredCount ?? this.values.length ?? 0
        }

        // TODO: fix sorting

        if (this.markedRowsAreSelected) {
            return this.markedRows.size
        } else {
            return (this.tableObjectFetcher.totalFilteredCount  ?? this.values.length ?? 0) - this.markedRows.size
        }
    }

    handleAction(action: TableAction<Value>, event) {
        if (action.needsSelection && this.getExpectedSelectionLength() === 0) {
            return
        }

        const selection = {
            isSingle: this.hasSingleSelection,
            hasSelection: this.hasSelection,
            getSelection: this.getSelection
        };

        if (action.hasChildActions) {
            const el = event.currentTarget;
            const bounds = el.getBoundingClientRect()
            const isOnTop = !(this.isIOS && this.isMobile)

            const displayedComponent = new ComponentWithProperties(TableActionsContextMenu, {
                x: bounds.left,
                y: isOnTop ? bounds.bottom : bounds.top,
                xPlacement: "right",
                yPlacement: isOnTop ? "bottom" : "top",
                actions: action.getChildActions(),
                selection
            });
            this.present(displayedComponent.setDisplayStyle("overlay"));
            return
        }

        action.handle(selection)?.catch((e) => {
            console.error(e)
            Toast.fromError(e).show
        })
    }

    showActions(isOnTop: boolean, event) {
        const el = event.currentTarget;
        const bounds = el.getBoundingClientRect()

        const actions = (this.isMobile && this.showSelection ? this.actions.filter(a => a.needsSelection) : this.actions.slice())

        // Also add select all actions
        if (!this.showSelection && !this.isIOS) {
            // Add select action
            actions.push(new TableAction({
                name: "Selecteer",
                groupIndex: -1,
                priority: 10,
                handler: () => {
                    this.setShowSelection(true)
                }
            }))
        }

        // Add select all action
        if (!this.isAllSelected) {
            actions.push(new TableAction({
                name: "Selecteer alles",
                groupIndex: -1,
                priority: 9,
                handler: () => {
                    this.setShowSelection(true)
                    this.setSelectAll(true)
                }
            }))
        } else {
            actions.push(new TableAction({
                name: "Deselecteer alles",
                groupIndex: -1,
                priority: 9,
                handler: () => {
                    this.setSelectAll(false)
                }
            }))
        }
        
        // Add action to change visible columns
        actions.push(new TableAction({
            name: this.wrapColumns ? "Wijzig zichtbare gegevens" : "Wijzig kolommen",
            groupIndex: -1,
            priority: 8,
            childMenu: this.getColumnContextMenu()
        }))

        actions.push(new TableAction({
            name: "Sorteren",
            groupIndex: -1,
            priority: 7,
            childMenu: this.getSortingContextMenu()
        }))

        const selection = {
            isSingle: this.hasSingleSelection,
            hasSelection: this.hasSelection,
            getSelection: this.getSelection
        };

        const displayedComponent = new ComponentWithProperties(TableActionsContextMenu, {
            x: bounds.right,
            y: bounds.top + (isOnTop ? el.offsetHeight : 0),
            xPlacement: "left",
            yPlacement: isOnTop ? "bottom" : "top",
            actions,
            selection
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }

    @Watch("tableObjectFetcher.objects", { deep: false })
    onUpdateValues() {
        for (const visibleRow of this.visibleRows) {
            // has this row changed and should it now display a different value? -> clear it and mark it for reuse
            if (visibleRow.currentIndex !== null && (visibleRow.currentIndex >= this.sortedValues.length || visibleRow.value !== this.sortedValues[visibleRow.currentIndex])) {
                // Mark this row to be reused
                visibleRow.value = null
                visibleRow.currentIndex = null
            }
        }

        // Update all rows
        this.updateVisibleRows()
        this.updateRecommendedWidths()
    }

    /**
     * Cached offset between scroll and top of the table
     */
    cachedTableYPosition: number | null = 0
    cachedScrollElement: HTMLElement | null = null

    getScrollElement(element: HTMLElement | null = null): HTMLElement {
        if (!element) {
            element = this.$el as HTMLElement;
        }

        const style = window.getComputedStyle(element);
        if (
            style.overflowY == "scroll" ||
            style.overflow == "scroll" ||
            style.overflow == "auto" ||
            style.overflowY == "auto" ||
            // Windows fix
            style.overflow == "overlay" ||
            style.overflowY == "overlay"
        ) {
            return element;
        } else {
            if (!element.parentElement) {
                return document.documentElement;
            }
            return this.getScrollElement(element.parentElement);
        }
    }

    updateVisibleRows() {
        let topOffset = 0

        const scrollElement = this.cachedScrollElement ?? this.getScrollElement(this.$refs["table"] as HTMLElement)
        this.cachedScrollElement = scrollElement

        // innerHeight is a fix for animations, causing wrong initial bouding client rect
        if (!this.cachedTableYPosition || this.cachedTableYPosition > window.innerHeight) {
            const tableBody = this.$refs["tableBody"] as HTMLElement
            const rect = tableBody.getBoundingClientRect();

            const top = rect.top
            this.cachedTableYPosition = top + scrollElement.scrollTop
        }

        // During animations, the scrollTop often jumps temporarily to a negative value
        topOffset = Math.max(0, (scrollElement.scrollTop - this.cachedTableYPosition))

        const totalItems = this.totalFilteredCount
        const extraItems = 10

        const firstVisibleItemIndex = Math.max(0, Math.min(Math.floor(topOffset / this.rowHeight) - extraItems, totalItems - 1))

        const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)

        const unBoundedLastVisibleItemIndex =  Math.max(0, Math.floor((topOffset + vh) / this.rowHeight) + extraItems)

        const lastVisibleItemIndex = Math.min(unBoundedLastVisibleItemIndex, totalItems - 1)

        //console.log("First visible item index: " + firstVisibleItemIndex + " Last visible item index: " + lastVisibleItemIndex)
        //console.log("vh: " + vh + " topOffset: " + topOffset + " rowHeight: " + this.rowHeight+" total: "+totalItems)
        //const neededCount = lastVisibleItemIndex - firstVisibleItemIndex + 1

        // Make all visible rows available if not visible any longer
        for (const visibleRow of this.visibleRows) {
            if (visibleRow.currentIndex === null || visibleRow.currentIndex < firstVisibleItemIndex || visibleRow.currentIndex > lastVisibleItemIndex) {
                // console.log("Freed visibleRow at index "+visibleRow.currentIndex)
                visibleRow.value = null
                visibleRow.currentIndex = null
            }
        }

        for (let index = firstVisibleItemIndex; index <= lastVisibleItemIndex; index++) {
            // Is this already visible?
            let visibleRow = this.visibleRows.find(r => r.currentIndex === index)
            if (visibleRow) {
                // Nothing to do, it's already visible
                visibleRow.y = index * this.rowHeight
                continue
            }

            //console.log("Row at index "+index+" is not yet loaded. Searching for a spot...")
            visibleRow = this.visibleRows.find(r => r.currentIndex === null)

            if (!visibleRow) {
                //console.log("Created new cached row for index "+index)
                visibleRow = new VisibleRow<Value>()
                this.visibleRows.push(visibleRow)
            }

            const value = this.sortedValues[index] ?? null

            visibleRow.value = value
            visibleRow.y = index * this.rowHeight
            visibleRow.currentIndex = index
            visibleRow.cachedSelectionValue = this.getSelectionValue(visibleRow)
        }

        //console.log("Rendered rows: "+this.visibleRows.length)
        this.tableObjectFetcher.setVisible(firstVisibleItemIndex, unBoundedLastVisibleItemIndex)
    }

    get rowHeight() {
        if (this.wrapColumns) {
            const padding = 15
            const firstColumnHeight = 16
            const otherColumnsHeight = 14
            const borderHeight = 2
            const margin = 6
            return padding * 2 + firstColumnHeight + ((otherColumnsHeight + margin) * Math.max(this.columns.length - 1, 0)) + borderHeight
        }
        return 60
    }

    // Can't use a watcher since rowHeight is never used
    updateRowHeight() {
        (this.$refs["table"] as HTMLElement).style.setProperty("--table-row-height", `${this.rowHeight}px`);
    }

    get totalFilteredCount() {
        if (this.errorMessage) {
            return 0;
        }
        return this.tableObjectFetcher.totalFilteredCount ?? this.estimatedRows ?? 0;
    }

    get totalItemsCount() {
        return this.tableObjectFetcher.totalCount
    }

    get totalHeight() {
        return this.rowHeight * this.totalFilteredCount
    }

    get errorMessage() {
        if (this.tableObjectFetcher.errorState) {
            const errors = this.tableObjectFetcher.errorState
            
            let simpleErrors!: SimpleErrors
            if (isSimpleError(errors)) {
                simpleErrors = new SimpleErrors(errors)
            } else if (isSimpleErrors(errors)) {
                simpleErrors = errors
            } else {
                simpleErrors = new SimpleErrors(new SimpleError({
                    code: "unknown_error",
                    message: errors.message
                }))
            }

            return simpleErrors.getHuman();
        }

        return null;
    }

    getPrevious(value: Value): Value | null {
        for (let index = 0; index < this.sortedValues.length; index++) {
            const _value = this.sortedValues[index];
            if (_value.id == value.id) {
                if (index == 0) {
                    return null;
                }
                return this.sortedValues[index - 1];
            }
        }
        return null;
    }

    getNext(value: Value): Value | null {
        for (let index = 0; index < this.sortedValues.length; index++) {
            const _value = this.sortedValues[index];
            if (_value.id == value.id) {
                if (index == this.sortedValues.length - 1) {
                    return null;
                }
                return this.sortedValues[index + 1];
            }
        }
        return null;
    }
}
</script>

<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;
@use '@stamhoofd/scss/base/text-styles' as *;

.table-view {
    --st-vertical-padding: 10px;
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;

    > main {
        overflow-y: auto;
    }

    // When scrolling horizontally, make sure the container doesn't scroll
    > main > .container {
        position: sticky;
        left: 0;

        > h1 + p {
            padding-bottom: 15px;
        }
    }
}

.table-column-content-style {
    font-size: 16px;
}

.column-style {
    &[data-style="gray"] {
        color: $color-gray-5;
    }

    &[data-style="success"], &[data-style="error"], &[data-style="info"], &[data-style="warn"], &[data-style="secundary"], &[data-style="tertiary"], &[data-style="tag-gray"] {
        > span {
            display: inline-block;
            font-size: 11px;
            text-transform: uppercase;
            font-weight: $font-weight-bold;
            padding: 7px 8px;
            border-radius: $border-radius;

            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
            box-sizing: border-box;
        }
        
    }

    &[data-style="success"] > span {
        background: $color-success-background;
        color: $color-success-dark;
    }

    &[data-style="error"] > span {
        background: $color-error-background;
        color: $color-error-dark;
    }

    &[data-style="info"] > span {
        background: $color-primary-background;
        color: $color-primary;
        
        @media (prefers-color-scheme: dark) {
            color: $color-primary-dark;
        }
    }

    &[data-style="warn"] > span {
        color: $color-warning-dark;
        background: $color-warning-background;
    }

    &[data-style="secundary"] > span {
        color: $color-secundary-dark;
        background: $color-secundary-background;
    }

    &[data-style="tertiary"] > span {
        color: $color-tertiary-dark;
        background: $color-tertiary-background;
    }

    &[data-style="tag-gray"] > span {
        color: $color-gray-1;
        background: $color-background-shade;
    }
}

.table-with-columns {
    margin: 0 calc(-1 * var(--st-horizontal-padding, 40px));
    margin-bottom: calc(-1 * var(--st-vertical-padding, 40px));
    padding-bottom: var(--st-vertical-padding, 40px);

    .inner-size {
        // This container determines the horizontal width and height.
        // And this should always be fixed for efficient layout calculations.
        // Why required? For the horizontal + vertical scrolling to work properly.

        contain: layout;
        // position: absolute;
        // width: 150%;
        // height: 100%;

        @supports not (contain: layout) {
            transform: translate3d(0, 0, 0);
        }

        // If the total width of all the columns is smaller than the total width, still force the table
        // to be 100% width
        min-width: 100%;
    }

    &.scroll {
        overflow: auto;
        flex-grow: 1;
        position: relative;
        z-index: 101;
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
        width: 100%;

        @supports not (contain: layout) {
            transform: translate3d(0, 0, 0);
        }
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
            justify-content: flex-start;
            align-items: center;
            padding-bottom: 2px;
            width: var(--selection-column-width, 50px);
        }

        .prefix-column {
            position: absolute;
            box-sizing: border-box;
            height: 100%;
            top: 0;
            display: flex;
            flex-wrap: nowrap;
            justify-content: flex-start;
            align-items: flex-start;
            padding-top: 15px;
            width: 50px;

            transition: transform 0.2s;

            @extend .column-style;

            
        }

        .columns {
            box-sizing: border-box;
            width: 100%;
            height: 100%;
            transform: translateX(0);
            transition: transform 0.2s;

           
        }
    }

    &.show-prefix {
        .table-row, .table-head {
            .columns {
                width: calc(100% - 50px);
                transform: translateX(50px);
            }
        }
    }

    &.show-checkbox {
        .table-row, .table-head {
            .prefix-column {
                transform: translateX(var(--selection-column-width, 50px));
            }

            .columns {
                width: calc(100% - var(--selection-column-width, 50px));
                transform: translateX(var(--selection-column-width, 50px));
            }
        }
    }

    &.show-checkbox.show-prefix {
        .table-row, .table-head {
            .columns {
                width: calc(100% - 50px - var(--selection-column-width, 50px));
                transform: translateX(calc(50px + var(--selection-column-width, 50px)));
            }
        }
    }

    &:not(.wrap) {
        padding-top: 20px;

        .table-head, .table-row {
            --selection-column-width: 50px;
            .columns {
                display: grid;
                grid-template-columns: var(--table-columns, repeat(auto-fit, minmax(0, 1fr)));
                align-items: center;
            }
        }

        .table-row {
            .columns {
                > div {
                    padding-right: 15px;

                    // Give numbers equal width
                    font-variant-numeric: tabular-nums;
                    
                    &.isDragging {
                        opacity: 0.5;
                    }

                    @extend .column-style;

                    &:last-child {
                        padding-right: 0;
                    }

                    transition: transform 0.2s, opacity 0.2s;

                    &.isDragging {
                        transform: translateX(var(--drag-x, 0px));
                        opacity: 0.5;

                        // Don't animate transform during drags
                        transition: opacity 0.2s;
                    }
                }
            }
        }
    }

    &.wrap {
        padding-top: 10px;

        .table-head {
            display: none;
        }

        .table-row {
            --selection-column-width: 40px;

            .columns {
                padding: 15px 0;
                display: block;

                > div {
                    font-size: 14px;
                    height: 14px;
                    line-height: 14px;
                    color: $color-gray-text;
                    box-sizing: content-box;

                    padding-top: 6px;

                    &:first-child {
                        font-size: 16px;
                        height: 16px;
                        line-height: 16px;
                        font-weight: $font-weight-medium;
                        color: $color-dark;
                    }

                    &:first-child {
                        padding-top: 0;
                    }

                    &:empty {
                        display: none;
                    }
                }

                
            }
        }
    }

    .table-head {
        height: 50px;
        border-bottom: $border-width-thin solid $color-border;
        margin-bottom: calc(-1 * #{$border-width-thin});
        position: sticky;
        top: 0px;
        z-index: 100;
        background: var(--color-current-background, #{$color-background} );
        padding-top: 0px;

        .columns > div {
            @extend .style-table-head;
            
            user-select: none;

            display: flex;
            flex-direction: row;
            align-items: center;
            padding-right: 10px;

            > button:first-child {
                flex-grow: 1;
                flex-shrink: 1;

                display: flex;
                flex-direction: row;
                align-items: center;
                min-width: 0;
                height: 40px;

                // This is the clickable part
                cursor: pointer;
                touch-action: manipulation;
                -webkit-tap-highlight-color: rgba(0, 0, 0, 0);

                // For drags
                transition: transform 0.2s, opacity 0.2s;

                &:active {
                    opacity: 0.6;
                }
            }

            &.isDragging {
                
                // During drag, we move all, except the column drag indicator
                > button:first-child {
                    transform: translateX(var(--drag-x, 0px));
                    opacity: 0.5;
                    cursor: grabbing;

                    // Don't animate transform during drags
                    transition: opacity 0.2s;

                    &:active {
                        opacity: 0.5;
                    }
                }
            }

            span:first-child {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            span {
                vertical-align: middle;
                min-width: 0;
            }

            .icon {
                flex-shrink: 0;
                margin-right: -8px;
            }

            .drag-handle-container {
                width: $border-width-thin;
                height: 20px;
                display: inline-block;
                position: relative;
                padding-left: 10px;
                flex-shrink: 0;

                &:before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 10px;
                    width: $border-width-thin;
                    height: 20px;
                    background: $color-border;
                    border-radius: $border-width-thin;
                }

                // The drag area
                .drag-handle {
                    content: '';
                    position: absolute;
                    top: -10px;
                    left: 9px;
                    bottom: -20px;
                    right: -1px;
                    cursor: col-resize;
                    touch-action: pan-x;
                    z-index: 1;
                    background: rgb(0, 89, 255);
                    opacity: 0;
                    transition: opacity 0.2s;
                    border-radius: 2px;

                    &:hover {
                        opacity: 1;
                        transition: opacity 0.2s 0.6s;
                    }

                    @media (pointer: coarse) {
                        left: 0px;
                        right: -20px;

                        &:hover {
                            opacity: 0;
                        }
                    }

                    &.reached-minimum {
                        cursor: e-resize;
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
        height: var(--table-row-height, 60px);

        .columns {
            border-top: $border-width-thin solid $color-border;

            > div {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                // will-change width makes column resizing a bit smoother on Safari (is more laggy in Safari)
                will-change: contents, width;
            }
        }

        .placeholder-skeleton {
            display: block;
            height: 1em;
            width: 10px;
            border-radius: 5px;
            background: $color-background-shade-darker;
        }

        //&.selectable {
            will-change: transform, background-color;
            transition: background-color 0.15s;
            cursor: pointer;
            touch-action: manipulation;
            -webkit-tap-highlight-color: transparent;
            -webkit-user-select: none;
            -webkit-touch-callout: none;
            user-select: none;

            @media (hover: hover) {
                &:hover {
                    background-color: $color-primary-lighter;
                }
            }

            &:active {
                background-color: $color-primary-light;
            }
        //}
    }
}
</style>
