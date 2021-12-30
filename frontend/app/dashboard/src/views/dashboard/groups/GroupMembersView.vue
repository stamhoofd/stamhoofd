<template>
    <TableView ref="table" :organization="organization" :title="title" :column-configuration-id="waitingList ? 'members-waiting-list' : 'members'" :actions="actions" :all-values="loading ? [] : allValues" :estimated-rows="estimatedRows" :all-columns="allColumns" :filter-definitions="filterDefinitions" @refresh="reload(false)" @click="openMember">
        <button v-if="titleDescription" class="info-box selectable" type="button" @click="resetCycle">
            {{ titleDescription }}

            <span class="button text">Reset</span>
        </button>

        <template #empty>
            <template v-if="cycleOffset != 0">
                Er zijn nog geen leden ingeschreven in deze inschrijvingsperiode.
            </template>

            <template v-else-if="group">
                Er zijn nog geen leden ingeschreven in deze inschrijvingsgroep.
            </template>

            <template v-else>
                Er zijn nog geen leden ingeschreven in deze categorie.
            </template>
        </template>
    </TableView>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from "@simonbackx/simple-encoding";
import { Request } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, Column, GlobalEventBus, LoadingButton, SegmentedControl, Spinner, STNavigationBar, STNavigationTitle, STToolbar, TableAction, TableView, Toast, TooltipDirective as Tooltip } from "@stamhoofd/components";
import { UrlHelper } from "@stamhoofd/networking";
import { ChoicesFilterChoice, ChoicesFilterDefinition, ChoicesFilterMode, getPermissionLevelNumber, Group, GroupCategoryTree, MemberWithRegistrations, Organization, PermissionLevel, RecordCategory, RecordCheckboxAnswer, RecordChooseOneAnswer, RecordMultipleChoiceAnswer, RecordSettings, RecordTextAnswer, RecordType, Registration, StringFilterDefinition } from '@stamhoofd/structures';
import { Formatter, Sorter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { MemberChangeEvent, MemberManager } from "../../../classes/MemberManager";
import { OrganizationManager } from "../../../classes/OrganizationManager";
import EditMemberView from "../member/edit/EditMemberView.vue";
import MemberView from "../member/MemberView.vue";
import BillingWarningBox from "../settings/packages/BillingWarningBox.vue";
import EditCategoryGroupsView from "./EditCategoryGroupsView.vue";
import EditGroupView from "./EditGroupView.vue";
import { MemberActionBuilder } from "./MemberActionBuilder";

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

    get organization() {
        return OrganizationManager.organization
    }

    mounted() {
        // Set url
        if (this.group) {
            UrlHelper.setUrl("/groups/"+Formatter.slug(this.group.settings.name))
            document.title = "Stamhoofd - "+this.group.settings.name
        } else {
            if (this.category) {
                UrlHelper.setUrl("/category/"+Formatter.slug(this.category.settings.name)+"/all")    
                document.title = "Stamhoofd - "+ this.category.settings.name +" - Alle leden"
            } else {
                UrlHelper.setUrl("/groups/all")    
                document.title = "Stamhoofd - Alle leden"
            }
            
        }
    }

    get estimatedRows() {
        if (!this.loading) {
            return 0
        }

        if (this.allValues.length > 0) {
            return this.allValues.length
        }

        if (this.group) {
            if (this.waitingList) {
                return this.group.settings.waitingListSize ?? 30
            }
            return this.group.settings.registeredMembers ?? 30
        }

        if (this.category) {
            return this.category.groups.reduce((sum, group) => sum + (group.settings.registeredMembers ?? 30), 0)
        }

        return 30
    }
    
    get actions(): TableAction<MemberWithRegistrations>[] {
        const builder = new MemberActionBuilder({
            component: this,
            group: this.group,
            cycleOffset: this.cycleOffset,
            inWaitingList: this.waitingList,
            hasWrite: this.hasWrite,
        })

        return [
            ...builder.getActions(),
            ...builder.getWaitingListActions(),
            new TableAction({
                name: "Nieuw lid",
                icon: "add",
                priority: 0,
                groupIndex: 1,
                needsSelection: false,
                enabled: this.hasWrite && !this.waitingList,
                handler: () => {
                    this.addMember()
                }
            }),

            new TableAction({
                name: "Openen",
                icon: "eye",
                priority: 0,
                groupIndex: 1,
                needsSelection: true,
                singleSelection: true,
                handler: (members: MemberWithRegistrations[]) => {
                    this.openMember(members[0])
                }
            }),

            new TableAction({
                name: "Open wachtlijst"+(this.group?.settings.waitingListSize ? (" ("+this.group.settings.waitingListSize+")") : ""),
                icon: "clock",
                priority: 0,
                groupIndex: 2,
                needsSelection: false,
                enabled: !this.waitingList && !!this.group && (this.group.settings.waitingListSize === null || this.group.settings.waitingListSize > 0),
                handler: () => {
                    this.openWaitingList()
                }
            }),

            new TableAction({
                name: "Vorige inschrijvingsperiode",
                icon: "arrow-up",
                priority: 0,
                groupIndex: 2,
                needsSelection: false,
                enabled: this.canGoBack,
                handler: () => {
                    this.goBack()
                }
            }),

            new TableAction({
                name: "Volgende inschrijvingsperiode",
                icon: "arrow-down",
                priority: 0,
                groupIndex: 2,
                needsSelection: false,
                enabled: this.canGoNext,
                handler: () => {
                    this.goNext()
                }
            }),

            new TableAction({
                name: "Instellingen",
                icon: "settings",
                priority: 0,
                groupIndex: 4,
                needsSelection: false,
                enabled: this.hasFull,
                handler: () => {
                    this.editSettings()
                }
            }),

        ]
    }

    allColumns = ((): Column<MemberWithRegistrations, any>[] => {
        const cols: Column<MemberWithRegistrations, any>[] = [
            new Column<MemberWithRegistrations, string>({
                name: "Naam", 
                getValue: (v) => v.name, 
                compare: (a, b) => Sorter.byStringValue(a, b),
                minimumWidth: 100,
                recommendedWidth: 300,
                grow: true,
            }),
            new Column<MemberWithRegistrations, string>({
                name: "Voornaam", 
                getValue: (v) => v.firstName, 
                compare: (a, b) => Sorter.byStringValue(a, b),
                enabled: false,
                minimumWidth: 100,
                recommendedWidth: 150,
                grow: true,
            }),
            new Column<MemberWithRegistrations, string>({
                name: "Achternaam", 
                getValue: (v) => v.details.lastName, 
                compare: (a, b) => Sorter.byStringValue(a, b),
                enabled: false,
                minimumWidth: 100,
                recommendedWidth: 150,
                grow: true,
            }),
            new Column<MemberWithRegistrations, number | null>({
                name: "Leeftijd", 
                getValue: (v) => v.details.age, 
                format: (v) => v !== null ? v+" jaar" : "Geen leeftijd", 
                getStyle: (v) => v === null ? "gray" : "",
                compare: (a, b) => Sorter.byNumberValue(b ?? 99, a ?? 99),
                minimumWidth: 100,
                recommendedWidth: 100
            }),
            new Column<MemberWithRegistrations, Date | null>({
                name: this.waitingList ? "Op wachtlijst sinds" : "Inschrijvingsdatum", 
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
                format: (v, width) => v ? (width < 160 ? (width < 120 ? Formatter.dateNumber(v, false) : Formatter.dateNumber(v, true)) : Formatter.date(v, true)) : "Onbekend",
                getStyle: (v) => v === null ? "gray" : "",
                compare: (a, b) => Sorter.byDateValue(b ?? new Date(1900, 0, 1), a ?? new Date(1900, 0, 1)),
                minimumWidth: 80,
                recommendedWidth: 160
            })
        ]

        if (!this.waitingList) {
            cols.push(
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
                    minimumWidth: 70,
                    recommendedWidth: 80,
                    align: "right"
                })
            )
        }

        if (this.waitingList && this.group) {
            cols.push(
                new Column<MemberWithRegistrations, boolean>({
                    name: "Status", 
                    getValue: (member) => !!member.registrations.find(r => r.groupId == this.group!.id && r.waitingList && r.canRegister && r.cycle == this.group!.cycle),
                    format: (canRegister) => {
                        if (canRegister) {
                            return "Uitgenodigd om in te schrijven";
                        }
                        return "Nog niet uitgenodigd"
                    }, 
                    getStyle: (canRegister) => !canRegister ? "gray" : "",
                    compare: (a, b) => Sorter.byBooleanValue(b, a),
                    minimumWidth: 100,
                    recommendedWidth: 150
                })
            )
        }

        return cols
    })()

    loading = true
    cycleOffset = 0

    get title() {
        return this.waitingList ? "Wachtlijst" : (this.group ? this.group.settings.name : (this.category ? this.category.settings.name : "Alle leden"))
    }

    get titleDescription() {
        if (this.cycleOffset === 1) {
            return "Dit is de vorige inschrijvingsperiode"
        }
        if (this.cycleOffset > 1) {
            return "Dit is "+this.cycleOffset+" inschrijvingsperiodes geleden"
        }
        return ""
    }


    get canGoBack() {
        return !this.loading // always allow to go to -1
    }

    get canGoNext() {
        return this.cycleOffset > 0 && !this.loading
    }

    goNext() {
        this.cycleOffset--
        this.reload()
    }

    goBack() {
        this.cycleOffset++
        this.reload()
    }

    resetCycle() {
        this.cycleOffset = 0
        this.reload()
    }

    get hasWrite() {
        if (!OrganizationManager.user.permissions) {
            return false
        }

        for (const group of this.groups) {
            if (!group.privateSettings || getPermissionLevelNumber(group.privateSettings.permissions.getPermissionLevel(OrganizationManager.user.permissions)) < getPermissionLevelNumber(PermissionLevel.Write)) {
                return false
            }
        }
        
        return true
    }

    get hasFull() {
        if (!OrganizationManager.user.permissions) {
            return false
        }
        
        for (const group of this.groups) {
            if (!group.privateSettings || getPermissionLevelNumber(group.privateSettings.permissions.getPermissionLevel(OrganizationManager.user.permissions)) < getPermissionLevelNumber(PermissionLevel.Full)) {
                return false
            }
        }
        
        return true
    }

    openMember(member: MemberWithRegistrations) {
        const table = this.$refs.table as TableView<MemberWithRegistrations> | undefined
        const component = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MemberView, {
                member: member,
                getNextMember: table?.getNext,
                getPreviousMember: table?.getPrevious,
                group: this.group,
                cycleOffset: this.cycleOffset,
                waitingList: this.waitingList
            }),
        });

        if ((this as any).$isMobile) {
            this.show(component)
        } else {
            component.modalDisplayStyle = "popup";
            this.present(component);
        }
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
        try {
            // Patch member with new details
            await MemberManager.checkInaccurateMetaData(this.allValues)
        } catch (e) {
            console.error(e)
            Toast.fromError(e).show()
        }
        this.checkingInaccurate = false
    }

    get groups() {
        if (this.group) {
            return [this.group]
        }
        if (this.category) {
            return this.category.groups
        }
        return []
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

    reload(visibleReload = true) {
        Request.cancelAll(this)
        this.loading = visibleReload;
        MemberManager.loadMembers(this.groupIds, this.waitingList, this.cycleOffset, this).then((members) => {
            // Make sure we keep as many references as possible
            MemberManager.sync(this.allValues, members)
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



    addMember() {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(EditMemberView, {

            })
        }).setDisplayStyle("popup"))
    }

    openWaitingList() {
        this.show(new ComponentWithProperties(GroupMembersView, {
            group: this.group,
            waitingList: true
        }))
    }

    editSettings() {
        if (!this.group) {
            if (this.category) {
                this.present(new ComponentWithProperties(NavigationController, { 
                    root: new ComponentWithProperties(EditCategoryGroupsView, { 
                        category: this.category, 
                        organization: OrganizationManager.organization, 
                        saveHandler: async (patch) => {
                            patch.id = OrganizationManager.organization.id
                            await OrganizationManager.patch(patch)
                        }
                    })
                }).setDisplayStyle("popup"))
            }

            return;
        }
        this.present(new ComponentWithProperties(EditGroupView, { 
            group: this.group, 
            organization: OrganizationManager.organization, 
            saveHandler: async (patch: AutoEncoderPatchType<Organization>) => {
                patch.id = OrganizationManager.organization.id
                await OrganizationManager.patch(patch)
                const g = OrganizationManager.organization.groups.find(g => g.id === this.group!.id)
                if (!g) {
                    this.pop({ force: true })
                } else {
                    this.group!.set(g)
                }
            }
        }).setDisplayStyle("popup"))
    }


  
}
</script>