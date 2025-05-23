<template>
    <div v-for="({categoryName, columns}, index) in groupedColumns" :key="visibleSheet.name + '-' + categoryName" class="container">
        <hr v-if="index > 0"><h2>{{ categoryName }}</h2>

        <STList>
            <STListItem element-name="label" :selectable="true" class="full-border">
                <template #left>
                    <Checkbox :model-value="getAllSelected(columns)" :indeterminate="getAllSelectedindeterminate(columns)" @update:model-value="setAllSelected($event, columns)" />
                </template>

                <div class="style-table-head">
                    {{ 'Alles selecteren' }}
                </div>
            </STListItem>

            <STListItem v-for="column of columns" :key="column.id" element-name="label" :selectable="true">
                <template #left>
                    <Checkbox v-model="column.enabled" />
                </template>

                <h3 class="style-title-list">
                    {{ column.name }}
                </h3>
                <p v-if="column.description" class="style-description-small">
                    {{ column.description }}
                </p>
            </STListItem>
        </STList>
    </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { SelectableColumn } from './SelectableColumn';
import { SelectableWorkbook } from './SelectableWorkbook';

const props = defineProps<{
    workbook: SelectableWorkbook;
}>();

const visibleSheet = ref(props.workbook.sheets[0]);

const groupedColumns = computed(() => {
    const categories: Map<string, { columns: SelectableColumn[]; categoryName: string }> = new Map();

    for (const column of visibleSheet.value.columns) {
        const category = column.category || '';

        if (!categories.has(category)) {
            categories.set(category, {
                columns: [],
                categoryName: category,
            });
        }
        categories.get(category)!.columns.push(column);
    }

    return Array.from(categories.values());
});

function getAllSelected(columns: SelectableColumn[]) {
    return columns.every(c => c.enabled);
}

function getAllSelectedindeterminate(columns: SelectableColumn[]) {
    return !getAllSelected(columns) && columns.some(c => c.enabled);
}

function setAllSelected(selected: boolean, columns: SelectableColumn[]) {
    for (const column of columns) {
        column.enabled = selected;
    }
}
</script>
