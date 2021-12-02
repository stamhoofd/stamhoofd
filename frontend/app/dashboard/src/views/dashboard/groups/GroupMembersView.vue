<template>
    <TableView :title="title" column-configuration-id="members" :all-values="allValues" :all-columns="allColumns" :filter-definitions="filterDefinitions" />
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, Column, LoadingButton, SegmentedControl, Spinner, STNavigationBar, STNavigationTitle, STToolbar, TableView, TooltipDirective as Tooltip } from "@stamhoofd/components";
import { ChoicesFilterChoice, ChoicesFilterDefinition, ChoicesFilterMode, Group, GroupCategoryTree, MemberWithRegistrations, PaymentStatus, RecordCategory, RecordCheckboxAnswer, RecordChooseOneAnswer, RecordMultipleChoiceAnswer, RecordSettings, RecordTextAnswer, RecordType, StringFilterDefinition } from '@stamhoofd/structures';
import { Formatter, Sorter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager";
import BillingWarningBox from "../settings/packages/BillingWarningBox.vue";

@Component({
    components: {
        Checkbox,
        STNavigationBar,
        STNavigationTitle,
        STToolbar,
        BackButton,
        Spinner,
        LoadingButton,
        SegmentedControl,
        BillingWarningBox,
        TableView
    },
    directives: { Tooltip },
})
export default class GroupMembersView extends Mixins(NavigationMixin) {
    @Prop({ default: null })
    group!: Group | null;

    @Prop({ default: null })
    category!: GroupCategoryTree | null;

    @Prop({ default: false })
    waitingList!: boolean;

    allValues: MemberWithRegistrations[] = []

    allColumns: Column<MemberWithRegistrations>[] = [
        new Column({
            name: "Naam", 
            getValue: (v) => v.name, 
            compare: (a, b) => Sorter.byStringValue(a.name, b.name),
            grow: 1,
            minimumWidth: 100,
            recommendedWidth: 150
        }),
        new Column({
            name: "Leeftijd", 
            getValue: (v) => v.details.age ? v.details.age+" jaar" : "", 
            compare: (a, b) => Sorter.byNumberValue(a.details.age ?? 99, b.details.age ?? 99),
            grow: 1,
            minimumWidth: 100,
            recommendedWidth: 150
        }),
        new Column({
            name: "Te betalen", 
            getValue: (v) => {
                const toPay = v.outstandingAmount
                if (toPay == 0) {
                    return "";
                }
                return Formatter.price(toPay)
            }, 
            compare: (a, b) => Sorter.byNumberValue(a.outstandingAmount, b.outstandingAmount),
            grow: 1,
            minimumWidth: 100,
            recommendedWidth: 150
        })
    ]

    get title() {
        return this.waitingList ? "Wachtlijst" : (this.group ? this.group.settings.name : (this.category ? this.category.settings.name : "Alle leden"))
    }

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

    get filterDefinitions() {
        const base = MemberWithRegistrations.getBaseFilterDefinitions(OrganizationManager.organization)

        for (const recordCategory of this.recordCategories) {
            for (const record of recordCategory.records) {
                if (record.type === RecordType.Checkbox) {
                    const def = new ChoicesFilterDefinition<MemberWithRegistrations>({
                        id: "record_"+record.id, 
                        name: record.name, 
                        category: recordCategory.name,
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
                        category: recordCategory.name,
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
                        category: recordCategory.name,
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
                        category: recordCategory.name,
                        getValue: (member) => {
                            const answer: RecordTextAnswer | undefined = member.details.recordAnswers.find(a => a.settings?.id === record.id) as any
                            return answer?.value ?? ""
                        }
                    })
                    base.push(def)
                }
            }
        }


        return base
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.group-members-view {
    .new-member-bubble {
        display: inline-block;
        vertical-align: middle;
        width: 5px;
        height: 5px;
        border-radius: 2.5px;
        background: $color-primary;
        margin-left: -10px;
        margin-right: 5px;
    }

    .member-description > p {
        white-space: pre-wrap;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 3;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .history-navigation-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-direction: row;
    }

    .title-description {
        padding-bottom: 20px;
    }
}
</style>
