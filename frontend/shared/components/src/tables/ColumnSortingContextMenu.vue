<template>
    <ContextMenuView v-bind="$attrs" ref="contextMenuView">
        <ContextMenuItemView v-for="column of sortedColumns" :key="column.id" @click="setSortByColumn(column)" :contextMenuView="$refs.contextMenuView">
            <template v-if="getSortByColumn(column)" #left><span :class="'icon '+getSortDirectionIcon()" /></template>
            <template v-else #left><span class="icon" /></template>
            {{ column.name }}
        </ContextMenuItemView>
    </ContextMenuView>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox,ContextMenuItemView, ContextMenuLine, ContextMenuView, TableView } from "@stamhoofd/components";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

import { Column } from "./Column";

@Component({
    components: {
        ContextMenuView,
        ContextMenuItemView,
        ContextMenuLine,
        Checkbox
    },
})
export default class ColumnSortingContextMenu extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    columns: Column<any, any>[];

    @Prop({ required: true })
    table: TableView<any>;

    setSortByColumn(column: Column<any, any>) {
        console.log("Toggle sort by column", column)
        this.table.toggleSort(column)
    }

    getSortByColumn(column: Column<any, any>) {
        return this.table.sortBy.id === column.id ? true : false
    }

    getSortDirectionIcon() {
        return this.table.sortDirection === "ASC" ? "arrow-up-small" : "arrow-down-small"
    }

    get sortedColumns() {
        return this.columns.slice().sort((a, b) => a.index - b.index)
    }

}
</script>
