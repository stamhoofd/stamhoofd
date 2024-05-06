<template>
    <ContextMenuView v-bind="$attrs" ref="contextMenuView">
        <ContextMenuItemView v-for="column of sortedColumns" :key="column.id" :contextMenuView="$refs.contextMenuView" element-name="label" @click="setColumnEnabled(column, !column.enabled)">
            <template #left><Checkbox :modelValue="column.enabled" :only-line="true" /></template>
            {{ column.name }}
        </ContextMenuItemView>
    </ContextMenuView>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox,ContextMenuItemView, ContextMenuLine,ContextMenuView } from "@stamhoofd/components";
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
export default class ColumnSelectorContextMenu extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    columns: Column<any, any>[];

    setColumnEnabled(column: Column<any, any>, enabled: boolean) {
        column.width = null
        column.renderWidth = null
        column.enabled = enabled
    }

    get sortedColumns() {
        return this.columns.slice().sort((a, b) => a.index - b.index)
    }

}
</script>
