<template>
    <ContextMenuView v-bind="$attrs" ref="contextMenuView">
        <ContextMenuItemView v-for="column of sortedColumns" :key="column.id" :context-menu-view="(contextMenuView as any)" @click="setSortByColumn(column)">
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

<script lang="ts" setup>
import ContextMenuItemView from '#overlays/ContextMenuItemView.vue';
import ContextMenuView from '#overlays/ContextMenuView.vue';
import { SortItemDirection } from "@stamhoofd/structures";
import { computed, useTemplateRef } from 'vue';

import type { Column } from '#tables/classes/Column.ts';

const props = defineProps<{
    columns: Column<any, any>[];
    setSort: (column: Column<any, any>, direction: SortItemDirection) => void;
    sortBy: Column<any, any>;
    sortDirection: SortItemDirection;
}>();

const contextMenuView = useTemplateRef('contextMenuView');

function setSortByColumn(column: Column<any, any>) {
    if (props.sortBy.id === column.id) {
        props.setSort(column, props.sortDirection === SortItemDirection.ASC ? SortItemDirection.DESC : SortItemDirection.ASC);
    }
    else {
        props.setSort(column, props.sortDirection);
    }
}

function getSortByColumn(column: Column<any, any>) {
    return props.sortBy.id === column.id ? true : false;
}

function getSortDirectionIcon() {
    return props.sortDirection === SortItemDirection.ASC ? "arrow-up-small" : "arrow-down-small";
}

const sortedColumns = computed(() => props.columns.filter(c => c.allowSorting).sort((a, b) => a.index - b.index));
</script>
