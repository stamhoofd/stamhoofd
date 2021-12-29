<template>
    <ContextMenu v-bind="$attrs">
        <ContextMenuItem v-for="column of sortedColumns" :key="column.id" @click="setSortByColumn(column)">
            <span v-if="getSortByColumn(column)" slot="left" :class="'icon '+getSortDirectionIcon()" />
            <span v-else slot="left" class="icon" />
            {{ column.name }}
        </ContextMenuItem>
    </ContextMenu>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox,ContextMenu, ContextMenuItem, ContextMenuLine, TableView } from "@stamhoofd/components";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { Column } from "./Column";

@Component({
    components: {
        ContextMenu,
        ContextMenuItem,
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
