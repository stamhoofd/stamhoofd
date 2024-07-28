<template>
    <div class="container">
        <p v-if="canPop" class="style-description-block">
            Met een filtergroep kan je combinaties van 'en' en 'of' maken.
        </p>

        <GroupUIFilterList v-if="filters.length" :filter="filter" @replace="copyFromChanged($event)"/>

        <hr v-if="filters.length">

        <STList>
            <STListItem v-for="(builder, index) in builders" :key="index" :selectable="true" class="right-stack" @click="addFilter(builder)">
                {{ builder.name }}

                <template #left>
                    <span class="button icon add gray" />
                </template>
            </STListItem>
        </STList>
    </div>
</template>


<script lang="ts" setup>
import { ComponentWithProperties, useCanPop, useShow } from "@simonbackx/vue-app-navigation";

import { computed } from "vue";
import STList from "../layout/STList.vue";
import STListItem from "../layout/STListItem.vue";
import { GroupUIFilter } from "./GroupUIFilter";
import { UIFilter, UIFilterBuilder } from "./UIFilter";
import UIFilterEditor from "./UIFilterEditor.vue";
import GroupUIFilterList from "./components/GroupUIFilterList.vue";

const props = defineProps<{
    filter: GroupUIFilter
}>();

const show = useShow()
const canPop = useCanPop()

const filters = computed(() => props.filter.filters);
const builders = computed(() => props.filter.builders);

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
                }
            })
        ]
    })
}

function copyFromChanged(filter: UIFilter|null) {
    if (!filter) {
        props.filter.filters = [];
        return;
    }

    if (filter instanceof GroupUIFilter) {
        props.filter.filters = filter.filters;
        props.filter.mode = filter.mode;
        return;
    }

    filters.value.splice(0, filters.value.length, filter);
}
</script>
