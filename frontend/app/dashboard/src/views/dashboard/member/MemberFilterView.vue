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
import { ChoicesFilterChoice, ChoicesFilterDefinition, ChoicesFilterMode, Filter, PaymentStatus, RecordCategory, RecordCheckboxAnswer, RecordChooseOneAnswer, RecordMultipleChoiceAnswer, RecordSettings, RecordTextAnswer, RecordType,StringFilterDefinition } from "@stamhoofd/structures";
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
            new StringFilterDefinition<MemberWithRegistrations>({
                id: "member_name", 
                name: "Naam lid", 
                getValue: (member) => {
                    return member?.name ?? ""
                }
            }),
            new ChoicesFilterDefinition<MemberWithRegistrations>({
                id: "active_registrations", 
                name: "Inschrijvingen", 
                choices: OrganizationManager.organization.groups.map(g => new ChoicesFilterChoice(g.id, g.settings.name)), 
                getValue: (member) => {
                    return member.groups.map(g => g.id)
                },
                defaultMode: ChoicesFilterMode.And
            }),
            new ChoicesFilterDefinition<MemberWithRegistrations>({
                id: "paid", 
                name: "Betaling", 
                choices: [
                    new ChoicesFilterChoice("checked", "Betaald"),
                    new ChoicesFilterChoice("not_checked", "Niet betaald"),
                ], 
                getValue: (member) => {
                    // todo: remove spaces
                    if (member.paid) {
                        return ["checked"]
                    }
                    return ["not_checked"]
                },
                defaultMode: ChoicesFilterMode.Or
            }),
            new ChoicesFilterDefinition<MemberWithRegistrations>({
                id: "financial_support", 
                name: "Financiële ondersteuning", 
                choices: [
                    new ChoicesFilterChoice("checked", "Vroeg financiële ondersteuning aan"),
                    new ChoicesFilterChoice("not_checked", "Geen financiële ondersteuning"),
                ], 
                getValue: (member) => {
                    // todo: remove spaces
                    if (member.details.requiresFinancialSupport?.value) {
                        return ["checked"]
                    }
                    return ["not_checked"]
                }
            })
        ]

        for (const record of this.records) {
            if (record.type === RecordType.Checkbox) {
                const def = new ChoicesFilterDefinition<MemberWithRegistrations>({
                    id: "record_"+record.id, 
                    name: record.name, 
                    choices: [
                        new ChoicesFilterChoice("checked", "Aangevinkt"),
                        new ChoicesFilterChoice("not_checked", "Niet aangevinkt")
                    ], 
                    getValue: (member) => {
                        const answer: RecordCheckboxAnswer | undefined = member.details.recordAnswers.find(a => a.settings?.id === record.id) as any
                        return answer?.selected ? ["checked"] : ["not_checked"]
                    },
                    defaultMode: ChoicesFilterMode.Or
                })
                base.push(def)
            }

            if (record.type === RecordType.MultipleChoice) {
                const def = new ChoicesFilterDefinition<MemberWithRegistrations>({
                    id: "record_"+record.id, 
                    name: record.name, 
                    choices: record.choices.map(c => new ChoicesFilterChoice(c.id, c.name)), 
                    getValue: (member) => {
                        const answer: RecordMultipleChoiceAnswer | undefined = member.details.recordAnswers.find(a => a.settings?.id === record.id) as any

                        if (!answer) {
                            return []
                        }

                        return answer.selectedChoices.map(c => c.id)
                    },
                    defaultMode: ChoicesFilterMode.And
                })
                base.push(def)
            }

            if (record.type === RecordType.ChooseOne) {
                const def = new ChoicesFilterDefinition<MemberWithRegistrations>({
                    id: "record_"+record.id, 
                    name: record.name, 
                    choices: record.choices.map(c => new ChoicesFilterChoice(c.id, c.name)), 
                    getValue: (member) => {
                        const answer: RecordChooseOneAnswer | undefined = member.details.recordAnswers.find(a => a.settings?.id === record.id) as any

                        if (!answer || !answer.selectedChoice) {
                            return []
                        }

                        return [answer.selectedChoice.id]
                    },
                    defaultMode: ChoicesFilterMode.Or
                })
                base.push(def)
            }

            if (record.type === RecordType.Text || record.type === RecordType.Textarea) {
                const def = new StringFilterDefinition<MemberWithRegistrations>({
                    id: "record_"+record.id, 
                    name: record.name, 
                    getValue: (member) => {
                        const answer: RecordTextAnswer | undefined = member.details.recordAnswers.find(a => a.settings?.id === record.id) as any
                        return answer?.value ?? ""
                    }
                })
                base.push(def)
            }
        }


        return base
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