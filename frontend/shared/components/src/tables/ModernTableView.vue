<template>
    <div class="modern st-view table-view background">
        <STNavigationBar :add-shadow="wrapColumns" :title="title" :disable-pop="true">
            <template #left>
                <button v-if="canLeaveSelectionMode && isMobile && showSelection && !isIOS" type="button" class="button icon navigation close" @click="setShowSelection(false)" />
                <button v-else-if="canLeaveSelectionMode && showSelection && isIOS" type="button" class="button navigation" @click="isAllSelected = !isAllSelected">
                    <template v-if="isAllSelected">
                        Deselecteer alles
                    </template>
                    <template v-else>
                        Selecteer alles
                    </template>
                </button>
                <BackButton v-else-if="canPop" @click="pop">
                    {{ backHint || 'Terug' }}
                </BackButton>
            </template>
            <template #right>
                <template v-if="!(isIOS && showSelection)">
                    <button v-for="(action, index) of filteredActions" :key="index" v-tooltip="action.tooltip" type="button" :class="'button icon navigation '+action.icon" :disabled="action.needsSelection && ((showSelection && isMobile) || !action.allowAutoSelectAll) && !hasSelection" @click="handleAction(action, $event)" />
                </template>

                <template v-if="showSelection && isIOS && canLeaveSelectionMode">
                    <button v-if="canLeaveSelectionMode" key="iOSDone" type="button" class="button navigation highlight" @click="setShowSelection(false)">
                        Gereed
                    </button>
                </template>
                <button v-else-if="!showSelection && isIOS && false" key="iOSSelect" type="button" class="button navigation" @click="setShowSelection(true)">
                    Selecteer
                </button>
                <button v-else key="actions" type="button" class="button icon more navigation" @click.prevent="showActions(true, $event)" @contextmenu.prevent="showActions(true, $event)" />
            </template>
        </STNavigationBar>

        <main>
            <div class="container">
                <h1 class="style-navigation-title">
                    {{ title }}
                    <span v-if="titleSuffix" class="title-suffix">
                        {{ titleSuffix }}
                    </span>
                </h1>
                <slot />

                <div class="input-with-buttons">
                    <div>
                        <form class="input-icon-container icon search gray" @submit.prevent="blurFocus">
                            <input v-model="searchQuery" class="input" name="search" placeholder="Zoeken" type="search" inputmode="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off">
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

            <div ref="tableElement" class="table-with-columns" :class="{ wrap: wrapColumns, 'show-checkbox': showSelection, 'show-prefix': showPrefix }">
                <div class="inner-size" :style="!wrapColumns ? { height: (totalHeight+50)+'px', width: totalRenderWidth+'px'} : {}">
                    <div class="table-head" @contextmenu.prevent="onTableHeadRightClick($event)">
                        <div v-if="showSelection" class="selection-column">
                            <Checkbox v-model="isAllSelected" />
                        </div>

                        <div class="columns">
                            <div v-for="(column, index) of columns" :key="column.id" :class="{isDragging: isDraggingColumn === column && isColumnDragActive && dragType === 'order'}" :data-align="column.align">
                                <button type="button" @mouseup.left="toggleSort(column)" @mousedown.left="(event) => columnDragStart(event, column)" @touchstart="(event) => columnDragStart(event, column)">
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
                                <span v-if="index < columns.length - 1" class="drag-handle-container"><span class="drag-handle" @mousedown="(event) => handleDragStart(event, column)" @touchstart="(event) => handleDragStart(event, column)" /></span>
                                <button v-else-if="canCollapse" v-tooltip="'Pas kolommen op het scherm'" type="button" class="button light-gray icon collapse-left" @click="collapse" />
                            </div>
                        </div>
                    </div>

                    <div ref="tableBody" class="table-body" :style="{ height: totalHeight+'px' }">
                        <div v-for="row of visibleRows" :key="row.id" v-long-press="(e) => onRightClickRow(row, e)" class="table-row" :class="{focused: isRowFocused(row) }" :style="{ transform: 'translateY('+row.y+'px)', display: row.currentIndex === null ? 'none' : '' }" @click="onClickRow(row, $event)" @contextmenu.prevent="(event) => onRightClickRow(row, event)">
                            <label v-if="showSelection" class="selection-column" @click.stop>
                                <Checkbox v-if="row.value" :key="row.value.id" :model-value="row.cachedSelectionValue" @update:model-value="setSelectionValue(row, $event)" />
                                <Checkbox v-else :model-value="isAllSelected" />
                            </label>
                            <div v-if="showPrefix && prefixColumn" class="prefix-column" :data-style="prefixColumn.getStyleFor(row.value, true)" :data-align="prefixColumn.align">
                                <span v-if="row.value" v-text="prefixColumn.getFormattedValue(row.value)" />
                                <span v-else class="placeholder-skeleton" :style="{ width: Math.floor(row.skeletonPercentage*100) + '%'}" />
                            </div>
                            <div class="columns">
                                <div v-for="column of columns" :key="column.id" :class="{isDragging: isDraggingColumn === column && isColumnDragActive && dragType === 'order' }" :data-style="column.getStyleFor(row.value)" :data-align="column.align">
                                    <span v-if="row.value" v-text="column.getFormattedValue(row.value)" />
                                    <span v-else class="placeholder-skeleton" :style="{ width: Math.floor(row.skeletonPercentage*(Math.min((!wrapColumns && column.width) ? column.width : 200, column.recommendedWidth)-30))+'px'}" />
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

        <STButtonToolbar v-if="isIOS && isMobile && showSelection && filteredActions.length">
            <button v-for="(action, index) of filteredActions" :key="index" type="button" class="button text small column selected" :disabled="action.needsSelection && (showSelection || !action.allowAutoSelectAll) && !hasSelection" @click="action.needsSelection && (showSelection || !action.allowAutoSelectAll) && !hasSelection ? undefined : handleAction(action, $event)">
                <span :class="'icon '+action.icon" />
            </button>

            <button v-long-press="(e) => showActions(false, e)" type="button" class="button text small column selected" @click="showActions(false, $event)">
                <span class="icon more" />
            </button>
        </STButtonToolbar>
    </div>
</template>


<script lang="ts" setup generic="Value extends TableListable">
import { ArrayDecoder, AutoEncoder, BooleanDecoder, Decoder, EnumDecoder, field, NumberDecoder, ObjectData, StringDecoder, VersionBox, VersionBoxDecoder } from "@simonbackx/simple-encoding";
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from "@simonbackx/simple-errors";
import { ComponentWithProperties, NavigationController, useCanPop, usePop, usePresent } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, STButtonToolbar, STNavigationBar, Toast, UIFilter, UIFilterBuilders, useDeviceWidth, useIsIOS, usePositionableSheet } from "@stamhoofd/components";
import { Storage } from "@stamhoofd/networking";
import { SortItemDirection, Version } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { v4 as uuidv4 } from "uuid";
import { computed, ComputedRef, getCurrentInstance, onActivated, onBeforeUnmount, onDeactivated, onMounted, reactive, Ref, ref, watch, watchEffect } from "vue";

import UIFilterEditor from "../filters/UIFilterEditor.vue";
import { AsyncTableAction, Column, FetchAllOptions, MenuTableAction, TableAction, TableActionSelection, TableObjectFetcher } from "./classes";
import ColumnSelectorContextMenu from "./ColumnSelectorContextMenu.vue";
import ColumnSortingContextMenu from "./ColumnSortingContextMenu.vue";
import TableActionsContextMenu from "./TableActionsContextMenu.vue";
 
export interface TableListable {
    id: string
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

const props = withDefaults(
    defineProps<{
        title: string,
        backHint?: string|null,
        actions?: TableAction<Value>[],
        estimatedRows?: number,
        tableObjectFetcher: TableObjectFetcher<Value>,
        filterBuilders?: UIFilterBuilders|null,
        columnConfigurationId: string,
        // warning: do not use as these are not reactive
        allColumns: Column<Value, any>[],
        prefixColumn?: Column<Value, any>|null,
        defaultSortColumn?: Column<Value, any>|null,
        defaultSortDirection?: SortItemDirection|null,
    }>(), {
        backHint: null,
        estimatedRows: 30,
        filterBuilders: null,
        prefixColumn: null,
        defaultSortColumn: null,
        defaultSortDirection: null,
        actions: () => [],
    }
)
const reactiveColumns = reactive(props.allColumns) as Column<Value, any>[]
const showPrefix = computed(() => props.prefixColumn !== null && wrapColumns.value && props.prefixColumn.enabled)
const columns = computed(() => {
    return reactiveColumns.filter(c => c.enabled && (!showPrefix.value || c.id !== props.prefixColumn?.id)).sort((a, b) => a.index - b.index)
}) as ComputedRef<Column<Value, any>[]>

const canPop = useCanPop();
const pop = usePop();
const present = usePresent();
const {presentPositionableSheet} = usePositionableSheet()

const deviceWidth = useDeviceWidth()
const isMobile = computed(() => deviceWidth.value < 600)
const wrapColumns = isMobile;

const showSelection = ref(!isMobile.value)
const isIOS = useIsIOS()
const titleSuffix = computed(() => props.tableObjectFetcher.totalCount === null ? '' : Formatter.integer(props.tableObjectFetcher.totalCount))

const instance = getCurrentInstance()
const hasClickListener = computed(() => !!instance?.vnode.props?.onClick)
const canLeaveSelectionMode = computed(() => wrapColumns.value || !hasClickListener.value)

const sortBy = ref(props.defaultSortColumn ?? columns.value[0]) as Ref<Column<Value, any>>;
const sortDirection = ref(props.defaultSortDirection ?? SortItemDirection.ASC) as Ref<SortItemDirection>;

const values = computed(() => props.tableObjectFetcher.objects)
const visibleRows = ref([]) as Ref<VisibleRow<Value>[]>;
const searchQuery = ref("")
const selectedUIFilter = ref(null) as Ref<null|UIFilter>;

watchEffect(() => {
    props.tableObjectFetcher.setSearchQuery(searchQuery.value)
    const filter = selectedUIFilter.value ? selectedUIFilter.value.build() : null;
    props.tableObjectFetcher.setFilter(filter)
})

function blurFocus() {
    (document.activeElement as HTMLElement)?.blur()
}

// If the user selects a row, we'll add it in the selectedRows. But if the user selects all rows, 
// we don't want to add them all, that would be a performance hit. So'ill invert it and only save the unselected values here.
const markedRows = ref(new Map<string, Value>());
const isRightClicking = ref(false);
const customFocusedRows = ref(null) as Ref<null|Set<string>>;

/**
 * When true: only the marked rows are selected.
 * When false: all rows are selected, except the marked rows
 */
const markedRowsAreSelected = ref(true)

const isAllSelected = computed({
    get: () => {
        if (markedRowsAreSelected.value) {
            return markedRows.value.size > 0 && markedRows.value.size === (props.tableObjectFetcher.totalFilteredCount ?? values.value.length)
        } else {
            return markedRows.value.size === 0
        }
    },
    set: (selected: boolean) => {
        markedRowsAreSelected.value = !selected
        markedRows.value.clear()
 
        for (const visibleRow of visibleRows.value) {
            visibleRow.cachedSelectionValue = selected
        }
    }
})
const hasSelection = computed(() => {
    return  markedRowsAreSelected.value ? markedRows.value.size > 0 : (((props.tableObjectFetcher.totalFilteredCount ?? values.value.length) - markedRows.value.size) > 0)
})
const hasSingleSelection = computed(() => {
    return markedRowsAreSelected.value && markedRows.value.size === 1
})

function setShowSelection(s: boolean) {
    showSelection.value = s
    if (!s) {
        isAllSelected.value = false
    }
}

const sortedActions = computed(() => {
    return props.actions.slice().sort((a, b) => {
        if (a.groupIndex !== b.groupIndex) {
            return a.groupIndex - b.groupIndex
        }
        return b.priority - a.priority
    })
})

const filteredActions = computed(() => {
    let maximum = 3;

    if (isIOS && isMobile.value && !showSelection.value) {
        maximum = 1;
    }

    if (!isMobile.value || !showSelection.value) {
        return sortedActions.value.filter(action => action.enabled && !action.singleSelection).slice(0, maximum)
    }

    return sortedActions.value.filter(action => {
        return action.enabled && action.needsSelection && !action.singleSelection
    }).slice(0, maximum)
})

function getColumnContextMenu() {
    return new ComponentWithProperties(ColumnSelectorContextMenu, {
        columns: reactiveColumns,
    })
}

function getSortingContextMenu() {
    return new ComponentWithProperties(ColumnSortingContextMenu, {
        columns: reactiveColumns,
        sortBy: sortBy.value,
        sortDirection: sortDirection.value,
        setSort: (column: Column<Value, any>, direction: SortItemDirection) => {
            sortBy.value = column
            sortDirection.value = direction
        }
    })
}

async function getTableActionFilter() {
    // todo
}

async function getSelection(options?: FetchAllOptions): Promise<Value[]> {
    if (!showSelection.value || !hasSelection.value) {
        return await props.tableObjectFetcher.fetchAll(options)
    }

    // TODO: fix sorting

    if (markedRowsAreSelected.value) {
        // No async needed
        return Array.from(markedRows.value.values()) as Value[]
    } else {
        const all = await props.tableObjectFetcher.fetchAll(options);
        return Array.from(all).filter(val => !markedRows.value.has(val.id))
    }
}

async function showActions(isOnTop: boolean, event: MouseEvent) {
    const el = event.currentTarget as HTMLElement;
    const bounds = el.getBoundingClientRect()

    const actions = (isMobile.value && showSelection.value ? props.actions.filter(a => a.needsSelection) : props.actions.slice())

    // Also add select all actions
    if (!showSelection.value) {
        // Add select action
        actions.push(new AsyncTableAction({
            name: "Selecteer",
            groupIndex: -1,
            priority: 10,
            needsSelection: false,
            handler: () => {
                showSelection.value = true
            }
        }))
    }

    // Add select all action
    if (!isAllSelected.value) {
        actions.push(new AsyncTableAction({
            name: "Selecteer alles",
            groupIndex: -1,
            priority: 9,
            needsSelection: false,
            handler: () => {
                showSelection.value = true
                isAllSelected.value = true;
            }
        }))
    } else {
        actions.push(new AsyncTableAction({
            name: "Deselecteer alles",
            groupIndex: -1,
            priority: 9,
            needsSelection: false,
            handler: () => {
                isAllSelected.value = false;
            }
        }))
    }
     
    // Add action to change visible columns
    actions.push(new MenuTableAction({
        name: wrapColumns.value ? "Wijzig zichtbare gegevens" : "Wijzig kolommen",
        groupIndex: -1,
        priority: 8,
        childMenu: getColumnContextMenu()
    }))

    actions.push(new MenuTableAction({
        name: "Sorteren",
        groupIndex: -1,
        priority: 7,
        childMenu: getSortingContextMenu()
    }))

    const selection = {
        isSingle: hasSingleSelection.value,
        hasSelection: hasSelection.value,
        getSelection: getSelection
    };

    const displayedComponent = new ComponentWithProperties(TableActionsContextMenu, {
        x: bounds.right,
        y: bounds.top + (isOnTop ? el.offsetHeight : 0),
        xPlacement: "left",
        yPlacement: isOnTop ? "bottom" : "top",
        actions,
        selection
    });
    await present(displayedComponent.setDisplayStyle("overlay"));
}

async function onTableHeadRightClick(event: MouseEvent) {
    // Show a context menu to select the available columns
    const displayedComponent = getColumnContextMenu();
    displayedComponent.properties.x = event.clientX
    displayedComponent.properties.y = event.clientY
    await present(displayedComponent.setDisplayStyle("overlay"));
}

const errorMessage = computed(() => {
    if (props.tableObjectFetcher.errorState) {
        const errors = props.tableObjectFetcher.errorState
        
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
});

const lastRefresh = ref(new Date())
function refresh() {
    lastRefresh.value = new Date()
    props.tableObjectFetcher.reset()
}

const totalFilteredCount = computed(() => {
    if (errorMessage.value) {
        return 0;
    }
    return props.tableObjectFetcher.totalFilteredCount ?? props.estimatedRows ?? 0;
});
const totalItemsCount = computed(() => props.tableObjectFetcher.totalCount);

function resetFilter() {
    searchQuery.value = ""
    selectedUIFilter.value = null
}

const isColumnDragActive = ref(false)

// Column drag helpers:
const isDraggingColumn = ref(null) as Ref<Column<any, any> | null>
let draggingStartX = 0
let draggingInitialWidth = 0
let draggingInitialColumns: Column<any, any>[] = []
const dragType = ref("width") as Ref<"width" | "order">

function toggleSort(column: Column<any, any>) {
    if (isColumnDragActive.value) {
        //console.log("Ignored sort toggle due to drag")
        return
    }
    if (column.allowSorting === false) {
        return
    }
    if (sortBy.value === column) {
        if (sortDirection.value === SortItemDirection.ASC) {
            sortDirection.value = SortItemDirection.DESC;
        } else {
            sortDirection.value = SortItemDirection.ASC;
        }
    } else {
        sortBy.value = column;
    }
    saveColumnConfiguration()
}

watchEffect(() => {
    props.tableObjectFetcher.setSort([
        {
            key: sortBy.value.id,
            order: sortDirection.value
        }
    ])
});

const hiddenItemsCount = computed(() => {
    if (props.tableObjectFetcher.totalCount ===  null || props.tableObjectFetcher.totalFilteredCount ===  null) {
        return 0;
    }
    return props.tableObjectFetcher.totalCount - props.tableObjectFetcher.totalFilteredCount;
});


const filteredText = computed(() => {
    return props.tableObjectFetcher.totalFilteredCount !== null ? `${props.tableObjectFetcher.totalFilteredCount}` : ''
});

function getEventX(event: any) {
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

const emit = defineEmits<{
    click: [value: Value]
}>()

function onClickRow(row: VisibleRow<Value>, event: MouseEvent) {
    if (event.metaKey || event.ctrlKey) {
        // Multi select rows
        setSelectionValue(row, !getSelectionValue(row))
        return
    }

    if (!hasClickListener.value || (wrapColumns.value && showSelection.value)) {
        // On mobile, tapping a column means selecting it when we are in editing modus
        setSelectionValue(row, !getSelectionValue(row))
        return
    }

    if (hasClickListener.value && row.value) {
        emit("click", row.value)
    }
}

async function onRightClickRow(row: VisibleRow<Value>, event: MouseEvent|TouchEvent) {
    if (!row.value) {
        return;
    }

    if (isMobile.value && !showSelection.value && !isIOS) {
        // On Android, the default long press action is switching to editing mode
        setSelectionValue(row, true)
        setShowSelection(true)
        return
    }

    isRightClicking.value = true
    const filteredActions = props.actions.filter(a => a.needsSelection);
    let selection: TableActionSelection<Value>;

    if (row.cachedSelectionValue && showSelection.value) {
        // Use full selection
        selection = {
            isSingle: hasSingleSelection.value,
            hasSelection: hasSelection.value,
            getSelection: getSelection,
            fetcher: props.tableObjectFetcher,
            markedRows: new Map(markedRows.value as Map<string, Value>),
            markedRowsAreSelected: markedRowsAreSelected.value
        };

        filteredActions.push(new AsyncTableAction({
            name: "Deselecteer",
            groupIndex: 1,
            priority: 10,
            handler: () => {
                // Clear selection
                isAllSelected.value = false
            }
        }))

        customFocusedRows.value = null
    } else {
        const markedRows = new Map<string, Value>()
        markedRows.set(row.value.id, row.value)
        selection = {
            isSingle: true,
            hasSelection: true,
            getSelection: () => {
                return [row.value!]
            },
            fetcher: props.tableObjectFetcher,
            markedRows,
            markedRowsAreSelected: true
        }

        // Only focus this row
        // Add select action
        filteredActions.push(new AsyncTableAction({
            name: "Selecteer",
            groupIndex: !showSelection.value ? -1 : 1,
            priority: 10,
            handler: () => {
                setSelectionValue(row, true)
                setShowSelection(true)
            }
        }))

        customFocusedRows.value = new Set([row.value.id])
    }

    // Show a context menu to select the available columns
    const displayedComponent = new ComponentWithProperties(TableActionsContextMenu, {
        x: "changedTouches" in event ? event.changedTouches[0].pageX : event.clientX,
        y: "changedTouches" in event ? event.changedTouches[0].pageY : event.clientY,
        actions: filteredActions,
        onDismiss: () => {
            isRightClicking.value = false
        },
        selection
    });
 
    await present(displayedComponent.setDisplayStyle("overlay"));
}
 
 
function columnDragStart(event: MouseEvent|TouchEvent, column: Column<any, any>) {
    // Don't allow drag with right mouse or other buttons
    if ('button' in event) {
        if (event.button !== 0) {
            return
        }
        if (event.button === 0 && (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)) {
            // Don't allow drag with ctrl+click
            return
        }
    }
    draggingStartX = getEventX(event);
    isDraggingColumn.value = column
    dragType.value = "order"
    draggingInitialColumns = columns.value.slice() as Column<any, any>[]
    isColumnDragActive.value = false
    attachDragHandlers()
}

function handleDragStart(event: MouseEvent|TouchEvent, column: Column<any, any>) {
    // Don't allow drag with right mouse or other buttons
    if ('button' in event) {
        if (event.button !== 0) {
            return
        }
        if (event.button === 0 && (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)) {
            // Don't allow drag with ctrl+click
            return
        }
    }

    draggingStartX = getEventX(event);
    isDraggingColumn.value = column
    dragType.value = "width"
    draggingInitialWidth = column.width ?? 0
    isColumnDragActive.value = false
    attachDragHandlers()
}

const horizontalPadding = ref(40)
const tableElement = ref(null) as Ref<HTMLElement | null>
const tableBody = ref(null) as Ref<HTMLElement | null>
const canCollapse = ref(false)

const selectionColumnWidth = computed(() => {
    return showSelection.value ? (wrapColumns.value ? 40 : 50) : 0
});

const totalWidth = computed(() => {
    const leftPadding = horizontalPadding.value
    const rightPadding = horizontalPadding.value
    return selectionColumnWidth.value + columns.value.reduce((acc, col) => acc + (col.width ?? 0), 0) + leftPadding + rightPadding
});

function updatePaddingIfNeeded() {
    if (horizontalPadding.value === 0) {
        updatePadding()
    }
}

function updatePadding() {
    if (!tableElement.value) {
        return
    }
    const padding = getComputedStyle(tableElement.value)
        .getPropertyValue('--st-horizontal-padding');

    horizontalPadding.value = parseInt(padding)
}

function attachDragHandlers() {
    updateRecommendedWidths();

    if (isColumnDragActive.value) {
        if (tableElement.value) {
            tableElement.value.style.cursor = dragType.value === "width" ? "col-resize" : "grabbing"
        }

    }
    document.addEventListener("mousemove", mouseMove, {
        passive: false,
    });
    document.addEventListener("touchmove", mouseMove, {
        passive: false,
    });

    document.addEventListener("mouseup", mouseUp, { passive: false });
    document.addEventListener("touchend", mouseUp, { passive: false });
}

function detachDragHandlers() {
    if (tableElement.value) {
        tableElement.value.style.cursor = ""
    }

    document.removeEventListener("mousemove", mouseMove);
    document.removeEventListener("touchmove", mouseMove);

    document.removeEventListener("mouseup", mouseUp);
    document.removeEventListener("touchend", mouseUp);

    saveColumnConfiguration()
}

function mouseMove(event: MouseEvent|TouchEvent) {
    if (!isDraggingColumn.value) {
        return
    }
    const currentX = getEventX(event)
    const difference = currentX - draggingStartX

    if (!isColumnDragActive.value) {
        if (Math.abs(difference) > 5) {
            isColumnDragActive.value = true;
            if (tableElement.value) {
                tableElement.value.style.cursor = dragType.value === "width" ? "col-resize" : "grabbing"
            }
        } else {
            return
        }
    }

    if (dragType.value === "width") {
        const currentWidth = totalWidth.value

        const newWidth = draggingInitialWidth + difference
        isDraggingColumn.value.width =  Math.max(newWidth, isDraggingColumn.value.minimumWidth)
        isDraggingColumn.value.renderWidth = Math.floor(isDraggingColumn.value.width)

        updateColumnWidth(isDraggingColumn.value, "move", currentWidth)
    } else {
        // We swap columns if the startX of the column moves over the middle of a different column            
        // Calculate how many columns we have moved in the X direction 
        const startIndex = draggingInitialColumns.findIndex(c => c.id === isDraggingColumn.value?.id)
        let columnMoveIndex = 0
        let remainingDifference = difference
        while (Math.sign(remainingDifference) === Math.sign(difference)) {
            const shouldMove = (remainingDifference < 0) ? -1 : 1
            const column = draggingInitialColumns[startIndex + shouldMove + columnMoveIndex]
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

        const columns = draggingInitialColumns.slice()
        columns.splice(startIndex, 1);
        columns.splice(startIndex + columnMoveIndex, 0, isDraggingColumn.value);

        // Update indexes
        for (let i = 0; i < columns.length; i++) {
            columns[i].index = i
        }

        // Translate moving column with mouse
        tableElement.value?.style.setProperty("--drag-x", `${remainingDifference}px`);

    }

    // Prevent scrolling (on mobile) and other stuff
    event.preventDefault();
    return false;
}

function mouseUp() {
    if (isDraggingColumn.value) {
        detachDragHandlers();
        isDraggingColumn.value = null;
    }
    isColumnDragActive.value = false
}

onMounted(() => {
    loadColumnConfiguration().catch(console.error)

    if (tableElement.value) {
        getScrollElement(tableElement.value).addEventListener("scroll", onScroll, { passive: true })
    }

    if (!canLeaveSelectionMode.value) {
        showSelection.value = true
    }

    refreshOnReturn()
});

// 
onActivated(() => {
    if (!wrapColumns.value) {
        window.addEventListener("resize", onResize, { passive: true })
        onResize()
    }
});

onDeactivated(() => {
    // Better to remove event resize listener, because on resize, we don't need to rerender the table
    window.removeEventListener("resize", onResize)
});

onBeforeUnmount(() => {
    // Remove event listeners
    if (tableElement.value) {
        getScrollElement(tableElement.value)?.removeEventListener("scroll", onScroll)
    }

    window.removeEventListener("resize", onResize)
    document.removeEventListener("visibilitychange", doRefresh)
    props.tableObjectFetcher.destroy();
});

function refreshOnReturn() {
    document.addEventListener("visibilitychange", doRefresh);
}

function doRefresh() {
    if (document.visibilityState === 'visible') {
        refresh()
    }
}

let ticking = false
function onScroll() {
    if (!ticking) {
        window.requestAnimationFrame(() => {
            updateVisibleRows()
            ticking = false;
        });

        ticking = true;
    }
}

function onResize() {
    // Force padding update
    updatePadding()

    if (canCollapse.value) {
        // Keep existing width
        updateCanCollapse()
    } else {
        // shrink or grow width
        updateColumnWidth()
    }
    updateVisibleRows()
}

// 
async function loadColumnConfiguration() {
    try {
        const json = await Storage.keyValue.getItem("column-configuration-"+props.columnConfigurationId)
        if (json !== null) {
            const parsed = new ObjectData(JSON.parse(json), { version: Version })
            const decoded = (new VersionBoxDecoder(ColumnConfiguration as Decoder<ColumnConfiguration>).decode(parsed)).data
 
            for (const col of reactiveColumns) {
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
                const _sort = reactiveColumns.find(c => c.id === decoded.sortColumnId)
                if (_sort) {
                    sortBy.value = _sort
                    sortDirection.value = decoded.sortDirection ?? SortItemDirection.ASC
                }
            }
 
            updateVisibleRows();
            updateRecommendedWidths();
 
            updateColumnWidth()
        } else {
            updateVisibleRows();
            updateRecommendedWidths();
            updateColumnWidth()
        }
    } catch (error) {
        console.error(error)
    }
}

watch(columns, () => {
    updateVisibleRows()

    if (canCollapse.value) {
        // Update width of new columns, without adjusting the width of any column
        fixColumnWidths(columns.value as any)
        updateCanCollapse()

        if (!canCollapse.value) {
            // Redistribute
            updateColumnWidth()
        }
    } else {
        updateColumnWidth()
    }
    saveColumnConfiguration()
});

function saveColumnConfiguration() {
    const configuration = ColumnConfiguration.create({
        // We also need to saveh  te prefix column
        columns: [...columns.value, ...(showPrefix.value ? [props.prefixColumn!] : [])].map(c => EnabledColumnConfiguration.create({ id: c.id, width: c.width ?? 0 })),
        canCollapse: canCollapse.value,
        sortColumnId: sortBy.value.id,
        sortDirection: sortDirection.value,
    })

    const versionBox = new VersionBox(configuration)
    const json = JSON.stringify(versionBox.encode({ version: Version }))
    Storage.keyValue.setItem("column-configuration-"+props.columnConfigurationId, json).catch(console.error)
}

/**
 * Loop all visible rows, and sets the recommended width of each column to the maximum width of the column.
 */
function updateRecommendedWidths() {
    //console.log("Update recommended width")
    const measureDiv = document.createElement("div")
    measureDiv.style.position = "absolute"
    measureDiv.style.visibility = "hidden"
    measureDiv.className = "table-column-content-style"
    document.body.appendChild(measureDiv)

    for (const column of columns.value) {
        let maximum = column.minimumWidth

        // Title
        const text = column.name
        measureDiv.innerText = text
        const width = measureDiv.clientWidth
        if (width > maximum) {
            maximum = width
        }
        let found = false

        for (const visibleRow of visibleRows.value) {
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
        }
    }

    document.body.removeChild(measureDiv)
}

 
function fixColumnWidths(columns: Column<any, any>[]) {
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
// 
/**
 * Update the width of the columns by distributing the available width across the columns, except the ignored column (optional)
 */
function updateColumnWidth(afterColumn: Column<any, any> | null = null, strategy: "grow" | "move" = "grow", forceWidth: number | null = null) {
    updatePaddingIfNeeded()
    // console.log("Update column width")
        
    if (wrapColumns.value) {
        return
    }

    if (!tableElement.value) {
        return;
    }
        
    const leftPadding = horizontalPadding.value
    const rightPadding = horizontalPadding.value

    const availableWidth = (forceWidth ?? tableElement.value.clientWidth) - selectionColumnWidth.value - leftPadding - rightPadding;

    if (isNaN(availableWidth) || availableWidth <= 0) {
        console.warn("Available width is NaN or <= 0")
        return
    }
    const currentWidth = columns.value.reduce((acc, col) => acc + (col.width ?? 0), 0);
    let distributeWidth = availableWidth - currentWidth;

    const affectedColumns = afterColumn ? columns.value.slice(columns.value.findIndex(c => c === afterColumn ) + 1) : columns.value
        
    // First fix columns without width and update distributeWidth accordongly, because this can change the sign whether we need to grow or shrink the other columns
    // Also update columns that are smaller than the minimumWidth
    distributeWidth += fixColumnWidths(affectedColumns)

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

            for (const col of columns) {
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
                distributeWidth = 0
                break
            }
        }

        // Now same with minimum
        for (const column of affectedColumns) {
            if (column.width == null) {
                continue;
            }

            if (distributeWidth < 0) {
                if (column.width > column.minimumWidth) {
                    const shrinkAmount = Math.min(-distributeWidth, column.width - column.minimumWidth);
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
                distributeWidth = 0
                break
            }
        }

        // Ignore remaining
        if (distributeWidth !== 0) {
            // Add back to afterColumn
            if (afterColumn && afterColumn.width !== null) {
                afterColumn.width += distributeWidth
                afterColumn.renderWidth = Math.floor(afterColumn.width);

                updateColumnWidth(null, 'grow')
            }
        }
    }

    updateCanCollapse()
}

function updateCanCollapse() {
    updatePaddingIfNeeded()

    if (wrapColumns.value) {
        return
    }
    if (!tableElement.value) {
        return
    }
    const n = canCollapse.value
    canCollapse.value = Math.floor(totalWidth.value) > Math.floor(tableElement.value.clientWidth);

    if (n !== canCollapse.value) {
        saveColumnConfiguration()
    }
}

function collapse() {
    updateColumnWidth(null, "grow")
    saveColumnConfiguration()
}

const totalRenderWidth = computed(() => {
    const leftPadding = horizontalPadding.value
    const rightPadding = horizontalPadding.value
    return selectionColumnWidth.value + columns.value.reduce((acc, col) => acc + (col.renderWidth ?? 0), 0) + leftPadding + rightPadding
});


const gridTemplateColumns = computed(() => {
    return columns.value.map(col => `${(col.renderWidth ?? 0)}px`).join(" ")
});

watchEffect(() => {
    if (!wrapColumns.value) {
        tableElement.value?.style.setProperty("--table-columns", gridTemplateColumns.value);
    }
});

const canFilter = computed(() => {
    return !!props.filterBuilders
});


async function editFilter(event: MouseEvent) {
    if (!props.filterBuilders) {
        return
    }
    const filter = selectedUIFilter.value ?? props.filterBuilders[0].create()
    if (!selectedUIFilter.value) {
        selectedUIFilter.value = filter;
    }

    await presentPositionableSheet(event, {
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(UIFilterEditor, {
                    filter
                })
            })
        ]
    })
}

function isValueSelected(value: Value) {
    const found = markedRows.value.has(value.id)

    if (markedRowsAreSelected.value) {
        return found
    } else {
        return !found
    }
}

function isRowFocused(row: VisibleRow<Value>) {
    if (!isRightClicking.value) {
        return false
    }

    if (customFocusedRows.value !== null) {
        if (!row.value) {
            return false
        }
        return customFocusedRows.value.has(row.value.id)
    }

    return row.cachedSelectionValue
}

function getSelectionValue(row: VisibleRow<Value>) {
    const value = row.value
    if (!value) {
        return isAllSelected.value
    }

    return isValueSelected(value)
}

function setSelectionValue(row: VisibleRow<Value>, selected: boolean) {
    const value = row.value
    if (!value) {
        return
    }
    if (selected) {
        if (markedRowsAreSelected.value) {
            markedRows.value.set(value.id, value)
        } else {
            markedRows.value.delete(value.id)
        }
    } else {
        if (!markedRowsAreSelected.value) {
            markedRows.value.set(value.id, value)
        } else {
            markedRows.value.delete(value.id)
        }
    }

    row.cachedSelectionValue = selected
}

function getExpectedSelectionLength(): number {
    if (!showSelection.value || !hasSelection.value) {
        return props.tableObjectFetcher.totalFilteredCount ?? values.value.length ?? 0
    }

    if (markedRowsAreSelected.value) {
        return markedRows.value.size
    } else {
        return (props.tableObjectFetcher.totalFilteredCount  ?? values.value.length ?? 0) - markedRows.value.size
    }
}

async function handleAction(action: TableAction<Value>, event: MouseEvent) {
    if (action.needsSelection && getExpectedSelectionLength() === 0) {
        return
    }

    const selection: TableActionSelection<Value> = {
        isSingle: hasSingleSelection.value,
        hasSelection: hasSelection.value,
        getSelection,
        fetcher: props.tableObjectFetcher,
        markedRows: new Map(markedRows.value as Map<string, Value>),
        markedRowsAreSelected: markedRowsAreSelected.value
    };

    if (action.hasChildActions) {
        const el = event.currentTarget as HTMLElement;
        const bounds = el.getBoundingClientRect()
        const isOnTop = !(isIOS && isMobile.value)

        const displayedComponent = new ComponentWithProperties(TableActionsContextMenu, {
            x: bounds.left,
            y: isOnTop ? bounds.bottom : bounds.top,
            xPlacement: "right",
            yPlacement: isOnTop ? "bottom" : "top",
            actions: action.getChildActions(),
            selection
        });
        await present(displayedComponent.setDisplayStyle("overlay"));
        return
    }

    action.handle(selection)?.catch((e) => {
        console.error(e)
        Toast.fromError(e).show
    })
}

watch(values, () => {
    console.log('Detected objects changed');
    for (const visibleRow of visibleRows.value) {
        // has this row changed and should it now display a different value? -> clear it and mark it for reuse
        if (visibleRow.currentIndex !== null && (visibleRow.currentIndex >= values.value.length || visibleRow.value !== values.value[visibleRow.currentIndex])) {
            // Mark this row to be reused
            visibleRow.value = null
            visibleRow.currentIndex = null
        }
    }

    // Update all rows
    updateVisibleRows()
    updateRecommendedWidths()
}, { deep: true });

function getScrollElement(element: HTMLElement): HTMLElement {
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
        return getScrollElement(element.parentElement);
    }
}

let cachedScrollElement: HTMLElement | null = null
let cachedTableYPosition: number | null = 0

function updateVisibleRows() {
    if (!tableElement.value) {
        return;
    }
    
    let topOffset = 0

    const scrollElement = cachedScrollElement ?? getScrollElement(tableElement.value)
    cachedScrollElement = scrollElement

    // innerHeight is a fix for animations, causing wrong initial bouding client rect
    if (!cachedTableYPosition || cachedTableYPosition > window.innerHeight) {
        if (!tableBody.value) {
            return;
        }

        const rect = tableBody.value.getBoundingClientRect();

        const top = rect.top
        cachedTableYPosition = top + scrollElement.scrollTop
    }

    // During animations, the scrollTop often jumps temporarily to a negative value
    topOffset = Math.max(0, (scrollElement.scrollTop - cachedTableYPosition))

    const totalItems = totalFilteredCount.value
    const extraItems = 5

    const firstVisibleItemIndex = Math.max(0, Math.min(Math.floor(topOffset / rowHeight.value) - extraItems, totalItems - 1))

    const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)

    const unBoundedLastVisibleItemIndex =  Math.max(0, Math.floor((topOffset + vh) / rowHeight.value) + extraItems)

    const lastVisibleItemIndex = Math.min(unBoundedLastVisibleItemIndex, totalItems - 1)

    // Make all visible rows available if not visible any longer
    for (const visibleRow of visibleRows.value) {
        if (visibleRow.currentIndex === null || visibleRow.currentIndex < firstVisibleItemIndex || visibleRow.currentIndex > lastVisibleItemIndex) {
            visibleRow.value = null
            visibleRow.currentIndex = null
        }
    }

    for (let index = firstVisibleItemIndex; index <= lastVisibleItemIndex; index++) {
        // Is this already visible?
        let visibleRow = visibleRows.value.find(r => r.currentIndex === index)
        if (visibleRow) {
            // Nothing to do, it's already visible
            visibleRow.y = index * rowHeight.value
            continue
        }

        visibleRow = visibleRows.value.find(r => r.currentIndex === null)

        if (!visibleRow) {
            visibleRow = new VisibleRow<Value>()
            visibleRows.value.push(visibleRow)
        }

        const value = values.value[index] ?? null

        visibleRow.value = value
        visibleRow.y = index * rowHeight.value
        visibleRow.currentIndex = index
        visibleRow.cachedSelectionValue = getSelectionValue(visibleRow)
    }

    //console.log("Rendered rows: "+visibleRows.value.length)
    props.tableObjectFetcher.setVisible(firstVisibleItemIndex, unBoundedLastVisibleItemIndex)
}

const rowHeight = computed(() => {
    if (wrapColumns.value) {
        const padding = 15
        const firstColumnHeight = 16
        const otherColumnsHeight = 14
        const borderHeight = 2
        const margin = 6
        return padding * 2 + firstColumnHeight + ((otherColumnsHeight + margin) * Math.max(columns.value.length - 1, 0)) + borderHeight
    }
    return 60
});

watchEffect(() => {
    tableElement.value?.style.setProperty("--table-row-height", `${rowHeight.value}px`);
});

const totalHeight = computed(() => {
    return rowHeight.value * totalFilteredCount.value
});

function getPrevious(value: Value): Value | null {
    for (let index = 0; index < values.value.length; index++) {
        const _value = values.value[index];
        if (_value.id == value.id) {
            if (index == 0) {
                return null;
            }
            return values.value[index - 1];
        }
    }
    return null;
}

function getNext(value: Value): Value | null {
    for (let index = 0; index < values.value.length; index++) {
        const _value = values.value[index];
        if (_value.id == value.id) {
            if (index == values.value.length - 1) {
                return null;
            }
            return values.value[index + 1];
        }
    }
    return null;
}

defineExpose({
    getPrevious,
    getNext
})

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
            @extend .style-placeholder-skeleton;
            width: 10px;
        }

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

                &.focused {
                    background-color: $color-primary-light;
                }
            }
        }

        &:active {
            background-color: $color-primary-light;
        }

        &.focused {
            background-color: $color-primary-light;
            
            &:after {
                content: '';
                position: absolute;
                top: 0px;
                right: 0;
                bottom: 0;
                width: 2px;
                background-color: $color-primary;
                z-index: 5;
            }

            &:before {
                content: '';
                position: absolute;
                top: 0px;
                left: 0;
                bottom: 0;
                width: 2px;
                background-color: $color-primary;
                z-index: 5;
            }
        }
    }
}
</style>
