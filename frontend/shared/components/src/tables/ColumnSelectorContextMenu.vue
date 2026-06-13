<template>
    <ContextMenuView v-bind="$attrs" ref="contextMenuView">
        <ContextMenuItemView v-for="column of sortedColumns" :key="column.id" :context-menu-view="(contextMenuView as any)" element-name="label" @click="setColumnEnabled(column, !column.enabled)">
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

<script lang="ts" setup>
import Checkbox from '#inputs/Checkbox.vue';
import ContextMenuItemView from '#overlays/ContextMenuItemView.vue';
import ContextMenuView from '#overlays/ContextMenuView.vue';
import { computed, useTemplateRef } from 'vue';

import type { Column } from '#tables/classes/Column.ts';

const props = defineProps<{
    columns: Column<any, any>[];
}>();

const contextMenuView = useTemplateRef('contextMenuView');

function setColumnEnabled(column: Column<any, any>, enabled: boolean) {
    if (enabled === false && !props.columns.find(c => c.enabled && c.id !== column.id)) {
        // Can't disable last
        return;
    }
    column.width = null;
    column.renderWidth = null;
    column.enabled = enabled;
}

const sortedColumns = computed(() => props.columns.slice().sort((a, b) => a.index - b.index));
</script>
