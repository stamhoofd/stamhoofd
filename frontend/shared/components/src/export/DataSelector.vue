<template>
    <div v-for="({categoryName, selectableData: _selectableData}, index) in groupedColumns" :key="name + '-' + categoryName" class="container">
        <hr v-if="index > 0"><h2>{{ categoryName }}</h2>

        <STList>
            <STListItem element-name="label" :selectable="true" class="full-border">
                <template #left>
                    <Checkbox :model-value="getAllSelected(_selectableData)" :indeterminate="getAllSelectedindeterminate(_selectableData)" @update:model-value="setAllSelected($event, _selectableData)" />
                </template>

                <div class="style-table-head">
                    {{ 'Alles selecteren' }}
                </div>
            </STListItem>

            <STListItem v-for="data of _selectableData" :key="data.id" element-name="label" :selectable="true">
                <template #left>
                    <Checkbox v-model="data.enabled" />
                </template>

                <h3 class="style-title-list">
                    {{ data.name }}
                </h3>
                <p v-if="data.description" class="style-description-small">
                    {{ data.description }}
                </p>
            </STListItem>
        </STList>
    </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { SelectableData } from './SelectableData';

const props = defineProps<{
    name: string;
    selectableData: SelectableData[];
}>();

const groupedColumns = computed(() => {
    const categories: Map<string, { selectableData: SelectableData[]; categoryName: string }> = new Map();

    for (const column of props.selectableData) {
        const category = column.category || '';

        if (!categories.has(category)) {
            categories.set(category, {
                selectableData: [],
                categoryName: category,
            });
        }
        categories.get(category)!.selectableData.push(column);
    }

    return Array.from(categories.values());
});

function getAllSelected(selectableData: SelectableData[]) {
    return selectableData.every(c => c.enabled);
}

function getAllSelectedindeterminate(selectableData: SelectableData[]) {
    return !getAllSelected(selectableData) && selectableData.some(c => c.enabled);
}

function setAllSelected(selected: boolean, selectableData: SelectableData[]) {
    for (const data of selectableData) {
        data.enabled = selected;
    }
}
</script>
