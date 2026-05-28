<template>
    <div class="input-with-buttons">
        <div>
            <form class="input-icon-container icon search gray" @submit.prevent="blurFocus">
                <input v-model="searchQuery" class="input" name="search" type="search" inputmode="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off" :placeholder="$t(`%KC`)">
            </form>
        </div>
        <div v-if="relationFetcher.subFilter">
            <button type="button" class="button text" @click="showSubFilters">
                <span class="icon filter" />
            </button>
        </div>
    </div>

    <div class="results">
        <STErrorsDefault :error-box="errorBox" />
        <STList v-if="invisibleSelectedOptions.length">
            <STListItem v-for="option of invisibleSelectedOptions" :key="option.value" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox :model-value="isOptionSelected(option as RelationFilterOption<T>)" @update:model-value="setOptionSelected(option as RelationFilterOption<T>, $event)" />
                </template>
                <h3 class="style-title-list">
                    {{ option.name }}
                </h3>
            </STListItem>
        </STList>
        <template v-if="infiniteObjectFetcher.errorState === null">
            <STList>
                <STListItem v-for="option of options" :key="option.value" :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox :model-value="isOptionSelected(option as RelationFilterOption<T>)" @update:model-value="setOptionSelected(option as RelationFilterOption<T>, $event)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ option.name }}
                    </h3>
                </STListItem>
            </STList>
            <InfiniteObjectFetcherEnd :fetcher="infiniteObjectFetcher" :empty-message="$t(`Geen resultaten`)" />
        </template>
    </div>
</template>

<script lang="ts" setup generic="T extends string | number | Date | null | boolean, ObjectType extends { id: string }">
import { mergeFilters } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { computed, ref, watchEffect } from 'vue';
import { ErrorBox } from '../errors/ErrorBox';
import { ContextMenu, ContextMenuItem } from '../overlays/ContextMenu';
import type { ObjectFetcher } from '../tables';
import { useInfiniteObjectFetcher } from '../tables';
import InfiniteObjectFetcherEnd from '../tables/InfiniteObjectFetcherEnd.vue';
import type { RelationFetcherSubFilterOption, RelationFilterOption, RelationUIFilter } from './RelationUIFilter';

const props = defineProps<{
    filter: RelationUIFilter<T>;
}>();

const relationFetcher = props.filter.relationFetcher;
const objectFetcher: ObjectFetcher<ObjectType> = relationFetcher.fetcher;
const infiniteObjectFetcher = useInfiniteObjectFetcher<ObjectType>(objectFetcher);
relationFetcher.configureInfiniteObjectFetcher(infiniteObjectFetcher);
const errorBox = computed(() => {
    if (infiniteObjectFetcher.errorState) {
        return new ErrorBox(infiniteObjectFetcher.errorState);
    }
    return null;
});

const searchQuery = ref('');
const selectedSubFilterOption = ref(null) as Ref<null | RelationFetcherSubFilterOption>;

watchEffect(() => {
    infiniteObjectFetcher.setSearchQuery(searchQuery.value);
});

const options = computed(() => props.filter.relationFetcher.resultsToOptions(infiniteObjectFetcher.objects));

const invisibleSelectedOptions = computed(() => {
    const visibleOptions = options.value;
    if (!visibleOptions) {
        return props.filter.values;
    }

    return props.filter.values.filter(option => {
        return !visibleOptions.some(vo => vo.value === option.value && vo.name === option.name);
    })
});

async function showSubFilters(event: MouseEvent) {
    const subFilter = relationFetcher.subFilter;
    if (!subFilter) {
        return;
    }

    const button = event.currentTarget as HTMLElement;

    const options = await subFilter.loadOptions();
    
    const menu = new ContextMenu([
        options.map(option => {
            return new ContextMenuItem({
                name: option.name,
                selected: selectedSubFilterOption.value === option,
                action: () => {
                    selectedSubFilterOption.value = option;
                    infiniteObjectFetcher.setFilter(mergeFilters([option.filter, relationFetcher.filter ?? null]))
                }
            })
        })
    ]);

    menu.show({ button, xPlacement: 'left'}).catch(console.error);
}

function blurFocus() {
    (document.activeElement as HTMLElement)?.blur();
}

function isOptionSelected(option: RelationFilterOption<T>) {
    return !!props.filter.values.find(i => i.value === option.value);
}

function setOptionSelected(option: RelationFilterOption<T>, selected: boolean) {
    if (selected === isOptionSelected(option)) {
        return;
    }

    if (!selected) {
        const index = props.filter.values.findIndex(i => i.value === option.value);
        if (index !== -1) {
            props.filter.values.splice(index, 1);
        }
    }
    else {
        props.filter.values.push(option);
    }
}
</script>

<style lang="scss" scoped>

.input-with-buttons {
    margin-bottom: 15px;
}
</style>
