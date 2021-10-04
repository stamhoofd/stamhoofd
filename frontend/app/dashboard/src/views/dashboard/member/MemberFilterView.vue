<template>
    <div class="st-view member-filter-view">
        <STNavigationBar title="Filter">
            <template #left>
                <BackButton v-if="canPop" @click="pop" />
            </template>
            <template #right>
                <button v-if="canDismiss" class="button icon close gray" @click="dismiss" />
            </template>
        </STNavigationBar>

        <main>
            <h1>
                Filter
            </h1>
            <!-- Todo: hier selector: nieuwe filter maken of bestaande filter bewerken, of opslaan als niewue filter -->

            <FilterGroupView :group="editingFilter" />
        </main>

        <STToolbar>
            <button slot="right" class="button primary full" @click="applyFilter">
                Toepassen
            </button>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STNavigationBar } from "@stamhoofd/components";
import { BackButton, FilterGroupView, STToolbar } from "@stamhoofd/components";
import { Filter, FilterStringDefinition } from "@stamhoofd/structures";
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
export default class MemberFilterView extends Mixins(NavigationMixin) {
    // todo
    // selectedFilter: SavedFilter | null
    // availableFilters: SavedFilter[]
    // saveFilter() -> saves


    @Prop({ required: true })
    selectedFilter!: Filter<MemberWithRegistrations> | null

    @Prop({ required: true })
    setFilter: (filter: Filter<MemberWithRegistrations>) => void

    editingFilter = this.selectedFilter?.clone() ?? new FilterGroup<MemberWithRegistrations>(this.definitions)

    get definitions() {
        return [
            new FilterStringDefinition<MemberWithRegistrations>("memberFirstname", "Voornaam lid", (member) => {
                return member?.firstName ?? ""
            }),
            new FilterStringDefinition<MemberWithRegistrations>("memberName", "Naam lid", (member) => {
                return member?.name ?? ""
            }),
            new FilterStringDefinition<MemberWithRegistrations>("memberLastname", "Achternaam lid", (member) => {
                return member?.details?.lastName ?? ""
            }),
            new FilterStringDefinition<MemberWithRegistrations>("memberPhone", "Telefoonnummer lid", (member) => {
                // todo: remove spaces
                return member?.details?.phone ?? ""
            })
        ]
    }

    applyFilter() {
        this.setFilter(this.editingFilter)
        console.log(this.editingFilter)
        this.dismiss({ force: true })
    }
}
</script>