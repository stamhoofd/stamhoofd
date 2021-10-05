<template>
    <form class="st-view member-filter-view" @submit.prevent="applyFilter">
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
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STNavigationBar } from "@stamhoofd/components";
import { BackButton, FilterGroupView, STToolbar } from "@stamhoofd/components";
import { ChoicesFilterChoice, ChoicesFilterDefinition, Filter, FilterStringDefinition, PaymentStatus, RecordCategory, RecordCheckboxAnswer, RecordSettings, RecordType } from "@stamhoofd/structures";
import { FilterGroup, MemberWithRegistrations } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager";


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

    get recordCategories(): RecordCategory[] {
        // todo: only show the record categories that are relevant for the given member (as soon as we implement filters)
        return OrganizationManager.organization.meta.recordsConfiguration.recordCategories.flatMap(category => {
            if (category.childCategories.length > 0) {
                return category.childCategories
            }
            return [category]
        })
    }

    get records(): RecordSettings[] {
        // todo: only show the record categories that are relevant for the given member (as soon as we implement filters)
        return this.recordCategories.flatMap(c => c.records)
    }

    get definitions() {
        const base = [
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
            }),
            new ChoicesFilterDefinition<MemberWithRegistrations>("paid", "Betaald", [
                new ChoicesFilterChoice("paid", "Betaald"),
                new ChoicesFilterChoice("not_paid", "Niet betaald"),
            ], (member) => {
                // todo: remove spaces
                if (member.paid) {
                    return ["paid"]
                }
                return ["not_paid"]
            })

        ]

        for (const record of this.records) {
            if (record.type === RecordType.Checkbox) {
                const def = new ChoicesFilterDefinition<MemberWithRegistrations>("record-"+record.id, record.name, [
                    new ChoicesFilterChoice("checked", "Aanvinkt"),
                    new ChoicesFilterChoice("not_checked", "Niet aangevinkt"),
                    new ChoicesFilterChoice("missing", "Niet ingevuld (info ontbreekt)")
                ], (member) => {
                    if (!member.details) {
                        return ["missing"]
                    }
                    if (!member.details.recordAnswers) {
                        return ["missing"]
                    }
                    const answer: RecordCheckboxAnswer | undefined = member.details.recordAnswers.find(a => a.settings?.id === record.id) as any

                    if (!answer) {
                        return ["missing"]
                    }

                    return answer.selected ? ["checked"] : ["not_checked"]
                })
                base.push(def)
            }
        }


        return base
    }

    resetFilter() {
        this.present(new ComponentWithProperties(MemberFilterView, {
            selectedFilter: this.selectedFilter,
            setFilter: this.setFilter
        }).setDisplayStyle("side-view"))
        //this.setFilter(new FilterGroup<MemberWithRegistrations>(this.definitions))
        //this.dismiss({ force: true })
    }

    applyFilter() {
        this.setFilter(this.editingFilter)
        this.dismiss({ force: true })
    }
}
</script>