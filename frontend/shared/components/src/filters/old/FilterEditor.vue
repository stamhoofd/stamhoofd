<template>
    <form class="st-view filter-editor" @submit.prevent="applyFilter">
        <STNavigationBar :title="title" />

        <main>
            <h1>
                {{ title }}
            </h1>
            <!-- Todo: hier selector: nieuwe filter maken of bestaande filter bewerken, of opslaan als niewue filter -->

            <FilterGroupView :group="editingFilter" :organization="organization" />
        </main>

        <STToolbar>
            <button v-if="editingFilter.filters.length > 0" slot="right" class="button secundary full" type="button" @click="resetFilter()">
                Resetten
            </button>
            <template #right><button class="button primary full" type="button" @click="applyFilter">
                Toepassen
            </button></template>
        </STToolbar>
    </form>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Filter, FilterDefinition, FilterGroup, Organization } from "@stamhoofd/structures";
import { Component, Mixins, Prop, Watch } from "@simonbackx/vue-app-navigation/classes";

import Checkbox from "../../inputs/Checkbox.vue";
import STList from "../../layout/STList.vue";
import STListItem from "../../layout/STListItem.vue";
import STNavigationBar from "../../navigation/STNavigationBar.vue";
import STToolbar from "../../navigation/STToolbar.vue";
import FilterGroupView from "./FilterGroupView.vue";

@Component({
    components: {
        STNavigationBar,
        FilterGroupView,
        STToolbar
    },
})
export default class FilterEditor extends Mixins(NavigationMixin) {
    @Prop({ default: "Filter" })
        title!: string

    @Prop({ required: true })
        selectedFilter!: FilterGroup<any> | null

    @Prop({ required: true })
        setFilter: (filter: Filter<any>) => void

    @Prop({ required: true })
        definitions!: FilterDefinition[]

    @Prop({ required: false })
        organization?: Organization

    editingFilter: FilterGroup<any> = (this.selectedFilter?.clone() ?? new FilterGroup<any>(this.definitions)) as FilterGroup<any>

    created() {
        if (this.editingFilter instanceof FilterGroup) {
            // Update definitions if needed
            this.editingFilter.setDefinitions(this.definitions)
        }
    }

    @Watch('editingFilter', { deep: true })
    onFilterChanged() {
        this.setFilter(this.editingFilter)
    }

    resetFilter() {
        this.setFilter(new FilterGroup<any>(this.definitions))
        this.dismiss({ force: true })
    }

    applyFilter() {
        this.setFilter(this.editingFilter)
        this.dismiss({ force: true })
    }
}
</script>