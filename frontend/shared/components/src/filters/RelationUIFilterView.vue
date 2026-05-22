<template>
    <div class="input-with-buttons">
        <div>
            <form class="input-icon-container icon search gray" @submit.prevent="blurFocus">
                <input v-model="searchQuery" class="input" name="search" type="search" inputmode="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off" :placeholder="$t(`%KC`)">
            </form>
        </div>
    </div>

    <div class="results">
        <STErrorsDefault :error-box="errors.errorBox" />
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
        <template v-if="errors.errorBox === null">
            <div v-if="options === null" class="spinner-container center">
                <Spinner />
            </div>
            <STList v-else-if="options.length">
                <STListItem v-for="option of options" :key="option.value" :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox :model-value="isOptionSelected(option as RelationFilterOption<T>)" @update:model-value="setOptionSelected(option as RelationFilterOption<T>, $event)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ option.name }}
                    </h3>
                </STListItem>
            </STList>
            <div v-else-if="invisibleSelectedOptions.length === 0">
                <p class="info-box">
                    {{ emptyMessage }}
                </p>
            </div>
        </template>
    </div>
</template>

<script lang="ts" setup generic="T extends string | number | Date | null | boolean">

import { throttle } from '@stamhoofd/utility';
import { computed, ref, watch } from 'vue';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import Spinner from '../Spinner.vue';
import type { RelationFilterOption, RelationUIFilter } from './RelationUIFilter';

const props = defineProps<{
    filter: RelationUIFilter<T>;
}>();

const searchQuery = ref('');
const options = ref<RelationFilterOption<T>[] | null>(null);
const invisibleSelectedOptions = computed(() => {
    const visibleOptions = options.value;
    if (!visibleOptions) {
        return props.filter.values;
    }

    return props.filter.values.filter(option => {
        return !visibleOptions.some(vo => vo.value === option.value && vo.name === option.name);
    })
})
const emptyMessage = ref<string>($t('Geen opties gevonden'));
const errors = useErrors();

const doThrottledLoad = throttle(fetchOptions, props.filter.searchDebounce);

watch(searchQuery, () => {
    doThrottledLoad();
});

function blurFocus() {
    (document.activeElement as HTMLElement)?.blur();
}

async function fetchOptions() {
    options.value = null;
    errors.errorBox = null;

    try {
        options.value = await props.filter.relationFetcher.fetch(searchQuery.value);
    } catch (e) {
        console.error(e);
        errors.errorBox = new ErrorBox(e);
    }

    emptyMessage.value = searchQuery.value.length === 0 ?  $t('Geen opties beschikbaar') : $t('Geen opties gevonden');
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

fetchOptions().catch(console.error);
</script>

<style lang="scss" scoped>

.results{
    margin-top: 15px;
    margin-bottom: 15px;
}
</style>
