<template>
    <div class="container">
        <p v-if="filter.builder.description" class="style-description-block">
            {{ filter.builder.description }}
        </p>

        <p v-else-if="canPop" class="style-description-block">
            {{ $t("%AE") }}
        </p>

        <GroupUIFilterList v-if="filters.length" :filter="filter" :is-group-filter="isGroupFilter" @replace="copyFromChanged($event)" />

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
import { AsyncComponent } from '#containers/AsyncComponent.ts';

import { computed } from 'vue';
import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import type { UIFilter, UIFilterBuilder } from './UIFilter';
import type { GroupUIFilterEditorProperties } from './GroupUIFilterTypes';

import GroupUIFilterList from './components/GroupUIFilterList.vue';

const props = defineProps<GroupUIFilterEditorProperties>();
const { filter, isGroupFilter, isGroupBuilder } = props;

const show = useShow();
const canPop = useCanPop();

const filters = computed(() => filter.filters);

function filterBuilders(builders: UIFilterBuilder[]) {
    return builders.filter(b => b.allowCreation === undefined || b.allowCreation === true);
}

const builders = computed(() => {
    if (filter.builders.length > 1 && isGroupBuilder(filter.builders[0]) && !filter.builders[0].wrapper) {
        // Remove first
        return filterBuilders(filter.builders.slice(1));
    }
    return filterBuilders(filter.builders).filter(b => b !== filter.builder);
});

async function addFilter(builder: UIFilterBuilder) {
    const filter = builder.create();
    await show({
        components: [
            AsyncComponent(() => import('./UIFilterEditor.vue'), {
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

    if (isGroupFilter(filter) && filter.builder === props.filter.builder) {
        props.filter.filters = filter.filters;
        props.filter.mode = filter.mode;
        return;
    }

    filters.value.splice(0, filters.value.length, filter);
}
</script>
