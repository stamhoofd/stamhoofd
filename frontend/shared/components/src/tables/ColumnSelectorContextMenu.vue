<template>
    <ContextMenuView v-bind="$attrs" ref="contextMenuView">
        <ContextMenuItemView v-for="column of sortedColumns" :key="column.id" :context-menu-view="$refs.contextMenuView" element-name="label" @click="setColumnEnabled(column, !column.enabled)">
            <template #left>
                <Checkbox :model-value="column.enabled" :only-line="true" />
            </template>
            <p>{{ column.name }}</p>
            <p v-if="column.description" class="description">
                {{ column.description }}
            </p>
        </ContextMenuItemView>
    </ContextMenuView>
</template>

<script lang="ts">
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Checkbox, ContextMenuItemView, ContextMenuLine, ContextMenuView } from '@stamhoofd/components';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';

import { Column } from './classes';

@Component({
    components: {
        ContextMenuView,
        ContextMenuItemView,
        ContextMenuLine,
        Checkbox,
    },
})
export default class ColumnSelectorContextMenu extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    columns: Column<any, any>[];

    setColumnEnabled(column: Column<any, any>, enabled: boolean) {
        if (enabled === false && !this.columns.find(c => c.enabled && c.id !== column.id)) {
            // Can't disable last
            return;
        }
        column.width = null;
        column.renderWidth = null;
        column.enabled = enabled;
    }

    get sortedColumns() {
        return this.columns.slice().sort((a, b) => a.index - b.index);
    }
}
</script>
