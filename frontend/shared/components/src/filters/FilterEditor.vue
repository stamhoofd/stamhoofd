<template>
    <form class="st-view filter-editor" @submit.prevent="applyFilter">
        <STNavigationBar :title="title" :dismiss="canDismiss" :pop="canPop" />

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
            <button slot="right" class="button primary full" type="button" @click="applyFilter">
                Toepassen
            </button>
        </STToolbar>
    </form>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, STNavigationBar } from "@stamhoofd/components";
import { BackButton, FilterGroupView, STToolbar } from "@stamhoofd/components";
import { Filter, FilterDefinition, Organization, Version } from "@stamhoofd/structures";
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
    selectedFilter!: FilterGroup<any> | null

    @Prop({ required: true })
    setFilter: (filter: Filter<any>) => void

    @Prop({ required: true })
    definitions!: FilterDefinition<any, any, any>[]

    @Prop({ required: false })
    organization?: Organization

    editingFilter: FilterGroup<any> = (this.selectedFilter?.clone() ?? new FilterGroup<any>(this.definitions)) as FilterGroup<any>

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

    isChanged() {
        if (this.selectedFilter === null) {
            return this.editingFilter.filters.length > 0
        }
        return JSON.stringify(this.editingFilter.encode({ version: Version })) != JSON.stringify(this.selectedFilter.encode({ version: Version }))
    }

    async shouldNavigateAway() {
        if (!this.isChanged()) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }
}
</script>