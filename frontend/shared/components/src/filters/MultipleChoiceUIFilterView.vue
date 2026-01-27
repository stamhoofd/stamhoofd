<template>
    <STList>
        <STListItem v-if="filter.configuration.showOptionSelectAll" :selectable="true" element-name="label">
            <template #left>
                <Checkbox v-model="isSelectAll" />
            </template>
            <h3 class="style-title-list">
                {{ $t('b183b823-481c-46b1-951d-8a68dccc2517') }}
            </h3>
        </STListItem>
        <template v-if="!isSelectAll">
            <STListItem v-for="(option, index) of options" :key="index" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox :model-value="isOptionSelected(option)" @update:model-value="setOptionSelected(option, $event)" />
                </template>
                <h3 class="style-title-list">
                    {{ option.name }}
                </h3>
            </STListItem>
        </template>
    </STList>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import Checkbox from '../inputs/Checkbox.vue';
import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import { MultipleChoiceUIFilter, MultipleChoiceUIFilterOption } from './MultipleChoiceUIFilter';

const props = defineProps<{ filter: MultipleChoiceUIFilter }>();

const isSelectAll = ref(false);

watch(isSelectAll, (isSelectAll) => {
    if (isSelectAll) {
        props.filter.selectedOptions = [...props.filter.builder.multipleChoiceOptions];
    }
    else {
        props.filter.selectedOptions = [];
    }
});

const options = computed(() => props.filter.builder.multipleChoiceOptions);

function isOptionSelected(option: MultipleChoiceUIFilterOption) {
    return !!props.filter.selectedOptions.find(i => i.value === option.value);
}

function setOptionSelected(option: MultipleChoiceUIFilterOption, selected: boolean) {
    if (selected === isOptionSelected(option)) {
        return;
    }
    if (!selected) {
        const index = props.filter.selectedOptions.findIndex(i => i.value === option.value);
        if (index !== -1) {
            props.filter.selectedOptions.splice(index, 1);
        }
    }
    else {
        props.filter.selectedOptions.push(option);
    }
}
</script>
