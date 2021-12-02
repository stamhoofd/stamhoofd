<template>
    <TableView :title="title" column-configuration-id="members" :all-values="allValues" :estimated-rows="estimatedRows" :all-columns="allColumns" :filter-definitions="filterDefinitions" />
</template>

<script lang="ts">
import { Request } from "@simonbackx/simple-networking";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, Column, GlobalEventBus, LoadingButton, SegmentedControl, Spinner, STNavigationBar, STNavigationTitle, STToolbar, TableView, Toast, TooltipDirective as Tooltip } from "@stamhoofd/components";
import { ChoicesFilterChoice, ChoicesFilterDefinition, ChoicesFilterMode, Group, GroupCategoryTree, MemberWithRegistrations, RecordCategory, RecordCheckboxAnswer, RecordChooseOneAnswer, RecordMultipleChoiceAnswer, RecordSettings, RecordTextAnswer, RecordType, Registration, StringFilterDefinition } from '@stamhoofd/structures';
import { Formatter, Sorter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { MemberChangeEvent, MemberManager } from "../../../classes/MemberManager";
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

    get estimatedRows() {
        return this.loading ? 30 : 0
    }

    allColumns = [
        new Column<MemberWithRegistrations, string>({
            name: "Naam", 
            getValue: (v) => v.name, 
            compare: (a, b) => Sorter.byStringValue(a, b),
            grow: 1,
            minimumWidth: 100,
            recommendedWidth: 300
        }),
        new Column<MemberWithRegistrations, number | null>({
            name: "Leeftijd", 
            getValue: (v) => v.details.age, 
            format: (v) => v !== null ? v+" jaar" : "Geen leeftijd", 
            getStyle: (v) => v === null ? "gray" : "",
            compare: (a, b) => Sorter.byNumberValue(b ?? 99, a ?? 99),
            grow: 1,
            minimumWidth: 100,
            recommendedWidth: 150
        }),
        new Column<MemberWithRegistrations, number>({
            name: "Te betalen", 
            getValue: (v) => v.outstandingAmount,
            format: (outstandingAmount) => {
                if (outstandingAmount == 0) {
                    return "Betaald";
                }
                return Formatter.price(outstandingAmount)
            }, 
            getStyle: (v) => v == 0 ? "gray" : "",
            compare: (a, b) => Sorter.byNumberValue(b, a),
            grow: 1,
            minimumWidth: 100,
            recommendedWidth: 150
        }),
        new Column<MemberWithRegistrations, Date | null>({
            name: "Inschrijvingsdatum", 
            getValue: (v) => {
                let registrations: Registration[] = []
                if (this.group) {
                    const group = this.group
                    registrations = v.registrations.filter(r => r.groupId == group.id && r.cycle == group.cycle - this.cycleOffset)
                } else  {
                    // Search registrations in this category
                    if (this.category) {
                        const groups = this.category.getAllGroups()
                        registrations = v.registrations.filter(r => {
                            const group = groups.find(g => g.id == r.groupId)
                            if (!group) {
                                return false
                            }
                            return r.cycle == group.cycle - this.cycleOffset
                        })
                    } else {
                        registrations = v.activeRegistrations;
                    }
                }
                if (registrations.length == 0) {
                    return null
                }
                const filtered = registrations.filter(r => r.registeredAt).map(r => r.registeredAt!.getTime())
                if (filtered.length == 0) {
                    return null
                }
                return new Date(Math.min(...filtered))
            }, 
            format: (v) => v ? Formatter.date(v, true) : "Onbekend",
            getStyle: (v) => v === null ? "gray" : "",
            compare: (a, b) => Sorter.byDateValue(b ?? new Date(1900, 0, 1), a ?? new Date(1900, 0, 1)),
            grow: 1,
            minimumWidth: 100,
            recommendedWidth: 150
        })
    ]

    loading = false
    cycleOffset = 0

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

    created() {
        this.reload();
    }

    activated() {
        MemberManager.addListener(this, this.onUpdateMember)
        GlobalEventBus.addListener(this, "encryption", async () => {
            this.reload()
            return Promise.resolve()
        })
    }

    onUpdateMember(type: MemberChangeEvent, member: MemberWithRegistrations | null) {
        if (type == "changedGroup" || type == "deleted" || type == "created" || type == "payment") {
            this.reload()
        }
    }

    deactivated() {
        MemberManager.removeListener(this)
        GlobalEventBus.removeListener(this)
    }

    beforeDestroy() {
        Request.cancelAll(this)
    }

    checkingInaccurate = false

    async checkInaccurateMetaData() {
        if (this.checkingInaccurate) {
            return
        }
        this.checkingInaccurate = true
        let toast: Toast | null = null
        try {
            const inaccurate: MemberWithRegistrations[] = []
            for (const member of this.allValues) {
                const meta = member.getDetailsMeta()

                // Check if meta is wrong
                if (!member.details.isRecovered && (!meta || !meta.isAccurateFor(member.details))) {
                    console.warn("Found inaccurate meta data!")
                    inaccurate.push(member)
                }
            }
            if (inaccurate.length > 0) {
                toast = new Toast("Gegevens van leden updaten naar laatste versie...", "spinner").setHide(null).show()

                // Patch member with new details
                await MemberManager.patchMembersDetails(inaccurate, false)
            }
        } catch (e) {
            console.error(e)
            Toast.fromError(e).show()
        }
        toast?.hide()
        this.checkingInaccurate = false
    }

    get groupIds() {
        if (this.group) {
            return [this.group.id]
        }
        if (this.category) {
            return this.category.groups.map(g => g.id) // needed because of permission check + existing check!
        }
        return []
    }

    reload() {
        Request.cancelAll(this)
        this.loading = true;
        
        MemberManager.loadMembers(this.groupIds, this.waitingList, this.cycleOffset, this).then((members) => {
            this.allValues = members
            this.checkInaccurateMetaData().catch(e => {
                console.error(e)
            })
        }).catch((e) => {
            console.error(e)

            if (!Request.isNetworkError(e)) {
                Toast.fromError(e).show()
            }
        }).finally(() => {
            this.loading = false
        })
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
