<template>
    <div class="container">
        <div v-for="(filter, index) of group.filters" :key="index" class="container">
            <hr>
            <h2 class="style-with-button">
                <div>
                    {{ filter.definition.name }}
                </div>
                <div>
                    <button class="button icon gray trash" type="button" @click="removeFilter(index)" />
                </div>
            </h2>
            <StringFilterView v-if="isStringFilter(filter)" :filter="filter" />
            <NumberFilterView v-else-if="isNumberFilter(filter)" :filter="filter" />
            <ChoicesFilterView v-else-if="isChoicesFilter(filter)" :filter="filter" />
            <p v-else class="error-box">
                Filter niet ondersteund
            </p>
        </div>

        <hr v-if="group.filters.length > 0">

        <p v-for="definition in group.definitions" :key="definition.id">
            <button class="button text" type="button" @click="addFilter(definition)">
                <span class="icon add" />
                <span>{{ definition.name }}</span>
            </button>
        </p>
    </div>
</template>


<script lang="ts">
import { STInputBox, STListItem } from "@stamhoofd/components"
import { ChoicesFilter, Filter, FilterDefinition, FilterGroup, NumberFilter, StringFilter } from "@stamhoofd/structures";
import { Component, Prop,Vue } from "vue-property-decorator";

import ChoicesFilterView from "./ChoicesFilterView.vue"
import NumberFilterView from "./NumberFilterView.vue"
import StringFilterView from "./StringFilterView.vue"

@Component({
    components: {
        STInputBox,
        STListItem,
        StringFilterView,
        NumberFilterView,
        ChoicesFilterView
    }
})
export default class FilterBuilderView extends Vue {
    @Prop({ required: true }) 
    group: FilterGroup<any>

    isStringFilter(filter: Filter<any>): boolean {
        return filter instanceof StringFilter
    }

    isNumberFilter(filter: Filter<any>): boolean {
        return filter instanceof NumberFilter
    }

    isChoicesFilter(filter: Filter<any>): boolean {
        return filter instanceof ChoicesFilter
    }

    addFilter(definition: FilterDefinition<any, Filter<any>, any>) {
        this.group.filters.push(definition.createFilter())
    }

    removeFilter(index: number) {
        this.group.filters.splice(index, 1)
    }
   
}
</script>