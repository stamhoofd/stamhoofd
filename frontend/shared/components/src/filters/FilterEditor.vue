<template>
    <form class="st-view filter-editor" @submit.prevent="applyFilter">
        <STNavigationBar :title="title">
            <template #left>
                <BackButton v-if="canPop" @click="pop" />
            </template>
            <template #right>
                <button v-if="canDismiss" class="button icon close gray" @click="dismiss" />
            </template>
        </STNavigationBar>

        <main>
            <h1>
                {{ title }}
            </h1>
            <!-- Todo: hier selector: nieuwe filter maken of bestaande filter bewerken, of opslaan als niewue filter -->

            <FilterGroupView :group="editingFilter" />
        </main>

        <STToolbar>
            <button v-if="editingFilter.filters.length > 0" slot="right" class="button secundary full" type="button" @click="resetFilter()">
                Resetten
            </button>
            <button slot="right" class="button primary full" type="button" @click="applyFilter">
                Toepassen
            </button>
        </STToolbar>
    </form>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STNavigationBar } from "@stamhoofd/components";
import { BackButton, FilterGroupView, STToolbar } from "@stamhoofd/components";
import { Filter, FilterDefinition } from "@stamhoofd/structures";
import { FilterGroup, MemberWithRegistrations } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "vue-property-decorator";


@Component({
    components: {
        STNavigationBar,
        BackButton,
        FilterGroupView,
        STToolbar
    },
})
export default class FilterEditor extends Mixins(NavigationMixin) {
    @Prop({ default: "Filter" })
    title!: string

    @Prop({ required: true })
    selectedFilter!: Filter<any> | null

    @Prop({ required: true })
    setFilter: (filter: Filter<any>) => void

    @Prop({ required: true })
    definitions!: FilterDefinition<any, any, any>[]

    editingFilter = this.selectedFilter?.clone() ?? new FilterGroup<MemberWithRegistrations>(this.definitions)

    created() {
        if (this.editingFilter instanceof FilterGroup) {
            // Update definitions if needed
            this.editingFilter.setDefinitions(this.definitions)
        }
    }

    resetFilter() {
        this.setFilter(new FilterGroup<MemberWithRegistrations>(this.definitions))
        this.dismiss({ force: true })
    }

    applyFilter() {
        this.setFilter(this.editingFilter)
        this.dismiss({ force: true })
    }
}
</script>