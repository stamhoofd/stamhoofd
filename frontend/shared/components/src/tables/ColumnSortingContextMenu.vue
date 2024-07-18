<template>
    <ContextMenuView v-bind="$attrs" ref="contextMenuView">
        <ContextMenuItemView v-for="column of sortedColumns" :key="column.id" :context-menu-view="$refs.contextMenuView" @click="setSortByColumn(column)">
            <template v-if="getSortByColumn(column)" #left>
                <span :class="'icon '+getSortDirectionIcon()" />
            </template>
            <template v-else #left>
                <span class="icon" />
            </template>
            {{ column.name }}
        </ContextMenuItemView>
    </ContextMenuView>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";
import { Checkbox, ContextMenuItemView, ContextMenuLine, ContextMenuView } from "@stamhoofd/components";

import { SortItemDirection } from "@stamhoofd/structures";
import { Column } from "./classes";

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
        setSort: (column: Column<any, any>, direction: SortItemDirection) => void
    
    @Prop({ required: true })
        sortBy: Column<any, any>;

    @Prop({ required: true })
        sortDirection: SortItemDirection

    setSortByColumn(column: Column<any, any>) {
        if (this.sortBy.id === column.id) {
            this.setSort(column, this.sortDirection === SortItemDirection.ASC ? SortItemDirection.DESC : SortItemDirection.ASC)
        } else {
            this.setSort(column, this.sortDirection)
        }
    }

    getSortByColumn(column: Column<any, any>) {
        return this.sortBy.id === column.id ? true : false
    }

    getSortDirectionIcon() {
        return this.sortDirection === "ASC" ? "arrow-up-small" : "arrow-down-small"
    }

    get sortedColumns() {
        return this.columns.filter(c => c.allowSorting).sort((a, b) => a.index - b.index)
    }

}
</script>
