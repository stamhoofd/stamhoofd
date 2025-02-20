<template>
    <div class="container">
        <p v-if="filter.builder.description" class="style-description-block">
            {{ filter.builder.description }}
        </p>

        <p v-else-if="canPop" class="style-description-block">
            {{ $t("bfc8aada-8c57-4789-9059-a7df4824e67b") }}
        </p>

        <GroupUIFilterList v-if="filters.length" :filter="filter" @replace="copyFromChanged($event)" />

        <hr v-if="filters.length">

        <STList>
            <STListItem v-for="(builder, index) in builders" :key="index" :selectable="true" class="right-stack" @click="addFilter(builder)">
                <h3 class="style-title-list">
                    {{ capitalizeFirstLetter(builder.name) }}
                </h3>
                <p v-if="'description' in builder" class="style-description-small">
                    {{ builder.description }}
                </p>

                <template #left>
                    <span class="button icon filter gray" />
                </template>
            </STListItem>
        </STList>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, useCanPop, useShow } from '@simonbackx/vue-app-navigation';

import { computed } from 'vue';
import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import { GroupUIFilter, GroupUIFilterBuilder } from './GroupUIFilter';
import { UIFilter, UIFilterBuilder } from './UIFilter';
import UIFilterEditor from './UIFilterEditor.vue';
import GroupUIFilterList from './components/GroupUIFilterList.vue';

const props = defineProps<{
    filter: GroupUIFilter;
}>();

const show = useShow();
const canPop = useCanPop();

const filters = computed(() => props.filter.filters);

function filterBuilders(builders: UIFilterBuilder[]) {
    return builders.filter(b => b.allowCreation === undefined || b.allowCreation === true);
}

const builders = computed(() => {
    if (props.filter.builders.length > 1 && props.filter.builders[0] instanceof GroupUIFilterBuilder && !props.filter.builders[0].wrapper) {
        // Remove first
        return filterBuilders(props.filter.builders.slice(1));
    }
    return filterBuilders(props.filter.builders).filter(b => b !== props.filter.builder);
});

async function addFilter(builder: UIFilterBuilder) {
    const filter = builder.create();
    await show({
        components: [
            new ComponentWithProperties(UIFilterEditor, {
                filter,
                saveHandler: (f: UIFilter) => {
                    const ff = f.flatten();
                    if (!ff) {
                        return;
                    }
                    filters.value.push(ff);
                    copyFromChanged(props.filter.flatten());
                },
            }),
        ],
    });
}

function copyFromChanged(filter: UIFilter | null) {
    if (!filter) {
        props.filter.filters = [];
        return;
    }

    if (filter instanceof GroupUIFilter && filter.builder === props.filter.builder) {
        props.filter.filters = filter.filters;
        props.filter.mode = filter.mode;
        return;
    }

    filters.value.splice(0, filters.value.length, filter);
}
</script>
