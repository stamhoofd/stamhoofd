<template>
    <div class="input-with-buttons">
        <div>
            <form class="input-icon-container icon search small gray" @submit.prevent="blurFocus">
                <input v-model="searchQuery" class="input" name="search" type="search" inputmode="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off" :placeholder="$t(`%KC`)">
            </form>
        </div>
        <div v-if="relationFetcher.subFilter">
            <button type="button" class="button text" @click="showSubFilters">
                <span class="icon filter" />
                <span v-if="selectedSubFilterOption?.filter" class="icon dot primary" />
            </button>
        </div>
    </div>

    <LoadingBoxTransition>
        <div v-if="infiniteObjectFetcher" class="results">
            <STErrorsDefault :error-box="errorBox" />
            <STList v-if="invisibleSelectedOptions.length">
                <STListItem v-for="option of invisibleSelectedOptions" :key="option.value" :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox :model-value="isOptionSelected(option as RelationFilterOption<T>)" @update:model-value="setOptionSelected(option as RelationFilterOption<T>, $event)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ option.name }}
                    </h3>
                    <p v-if="option.description" class="style-description-small">
                        {{ option.description }}
                    </p>
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
                        <p v-if="option.description" class="style-description-small">
                            {{ option.description }}
                        </p>
                    </STListItem>
                </STList>
                <InfiniteObjectFetcherEnd :fetcher="infiniteObjectFetcher" :empty-message="$t(`Geen resultaten`)" />
            </template>
        </div>
    </LoadingBoxTransition>
</template>

<script lang="ts" setup generic="T extends string | number | Date | null | boolean, ObjectType extends { id: string }">
import { LoadingBoxTransition } from '#containers/index.ts';
import type { StamhoofdFilter } from '@stamhoofd/structures';
import { mergeFilters } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { computed, ref, watchEffect } from 'vue';
import { ErrorBox } from '../errors/ErrorBox';
import { ContextMenu, ContextMenuItem } from '../overlays/ContextMenu';
import type { InfiniteObjectFetcher, ObjectFetcher } from '../tables';
import { useInfiniteObjectFetcher } from '../tables';
import InfiniteObjectFetcherEnd from '../tables/InfiniteObjectFetcherEnd.vue';
import type { RelationFetcherSubFilterOption, RelationFilterOption, RelationUIFilter } from './RelationUIFilter';

const props = defineProps<{
    filter: RelationUIFilter<T>;
}>();

const relationFetcher = props.filter.relationFetcher;
const objectFetcher: ObjectFetcher<ObjectType> = relationFetcher.fetcher;
const infiniteObjectFetcher = ref<InfiniteObjectFetcher<ObjectType> | null>(null) as Ref<InfiniteObjectFetcher<ObjectType> | null>;

function initInfiniteObjectFetcher(subFilter?: StamhoofdFilter) {
    if (infiniteObjectFetcher.value) {
        return;
    }

    const fetcher = useInfiniteObjectFetcher<ObjectType>(objectFetcher);
    relationFetcher.configureInfiniteObjectFetcher(fetcher);

    if (subFilter) {
        setInfiniteObjectFetcherFilter(fetcher, subFilter);
    }

    infiniteObjectFetcher.value = fetcher;
}

function setInfiniteObjectFetcherFilter(fetcher: InfiniteObjectFetcher<ObjectType>, filter: StamhoofdFilter) {
    fetcher.setFilter(mergeFilters([filter, relationFetcher.filter ?? null]));
}

const errorBox = computed(() => {
    if (infiniteObjectFetcher.value && infiniteObjectFetcher.value.errorState) {
        return new ErrorBox(infiniteObjectFetcher.value.errorState);
    }
    return null;
});

const searchQuery = ref('');

watchEffect(() => {
    if (!infiniteObjectFetcher.value) {
        return;
    }
    infiniteObjectFetcher.value.setSearchQuery(searchQuery.value);
});

const options = computed(() => props.filter.relationFetcher.resultsToOptions(infiniteObjectFetcher.value?.objects ?? []));

const invisibleSelectedOptions = computed(() => {
    const visibleOptions = options.value;
    if (!visibleOptions) {
        return props.filter.values;
    }

    return props.filter.values.filter((option) => {
        return !visibleOptions.some(vo => vo.value === option.value && vo.name === option.name);
    });
});

const selectedSubFilterOption = ref(null) as any as Ref<RelationFetcherSubFilterOption | null>;

const subFilterOptions = ref<null | RelationFetcherSubFilterOption[]>(null);

if (props.filter.relationFetcher.subFilter && props.filter.relationFetcher.subFilter.shouldHaveDefaultFilter) {
    props.filter.relationFetcher.subFilter.loadOptions().then((options) => {
        setSubFilterOptions(options);
    }).catch(console.error);
} else {
    initInfiniteObjectFetcher();
}

function setSubFilterOption(option: RelationFetcherSubFilterOption) {
    if (infiniteObjectFetcher.value === null) {
        initInfiniteObjectFetcher(option.filter);
    } else {
        setInfiniteObjectFetcherFilter(infiniteObjectFetcher.value, option.filter);
    }

    selectedSubFilterOption.value = option;
}

function setSubFilterOptions(options: RelationFetcherSubFilterOption[]) {
    subFilterOptions.value = options;
    if (selectedSubFilterOption.value === null && props.filter.relationFetcher.subFilter) {
        setSubFilterOption(props.filter.relationFetcher.subFilter.getDefaultOption(options));
    }
}

async function showSubFilters(event: MouseEvent) {
    const subFilter = relationFetcher.subFilter;
    if (!subFilter) {
        return;
    }

    const button = event.currentTarget as HTMLElement;

    const allOptions = await subFilter.getAllOptions();
    setSubFilterOptions(allOptions);

    const menu = new ContextMenu([
        allOptions.map((option) => {
            return new ContextMenuItem({
                name: option.name,
                selected: selectedSubFilterOption.value && selectedSubFilterOption.value.name === option.name,
                action: () => {
                    selectedSubFilterOption.value = option;
                    infiniteObjectFetcher.value?.setFilter(mergeFilters([option.filter, relationFetcher.filter ?? null]));
                },
            });
        }),
    ]);

    menu.show({ button, xPlacement: 'left' }).catch(console.error);
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
    } else {
        props.filter.values.push(option);
    }
}
</script>

<style lang="scss" scoped>

.input-with-buttons {
    margin-bottom: 15px;
}
</style>
