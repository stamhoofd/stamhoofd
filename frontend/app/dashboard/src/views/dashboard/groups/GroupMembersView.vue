<template>
    <TableView ref="table" :back-hint="backHint" :organization="organization" :title="title" :column-configuration-id="waitingList ? 'members-waiting-list' : (category ? 'category-' + category.id : 'members')" :actions="actions" :all-values="loading ? [] : allValues" :estimated-rows="estimatedRows" :all-columns="allColumns" @refresh="reload(false)" @click="openMember">
        <template #empty>
            <template v-if="cycleOffset != 0">
                Er zijn nog geen leden ingeschreven in deze {{ waitingList ? 'wachtlijst tijdens deze periode' : 'inschrijvingsperiode' }}.
            </template>

            <template v-else-if="group">
                Er zijn nog geen leden ingeschreven in deze {{ waitingList ? 'wachtlijst' : 'groep' }}.
            </template>

            <template v-else>
                Er zijn nog geen leden ingeschreven in deze categorie.
            </template>
        </template>
    </TableView>
</template>

<script lang="ts">
import { Request } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";
import { Column, GlobalEventBus, TableAction, TableView, Toast } from "@stamhoofd/components";
import { UrlHelper } from "@stamhoofd/networking";
import { Group, GroupCategoryTree, MemberWithRegistrations, RecordCategory, RecordSettings } from '@stamhoofd/structures';
import { Formatter, Sorter } from "@stamhoofd/utility";

import { MemberChangeEvent } from "../../../classes/MemberManager";
import MemberSegmentedView from "../member/MemberSegmentedView.vue";
import { MemberActionBuilder } from "./MemberActionBuilder";

@Component({
    components: {
        TableView
    }
})
export default class GroupMembersView extends Mixins(NavigationMixin) {
    @Prop({ default: null })
        group!: Group | null;

    @Prop({ default: null })
        category!: GroupCategoryTree | null;

    @Prop({ default: 0 })
        initialCycleOffset!: number

    loading = true
    cycleOffset = this.initialCycleOffset

    @Prop({ default: false })
        waitingList!: boolean;

    allValues: MemberWithRegistrations[] = []

    openMemberOnLoad: string | null = null

    get organization() {
        return this.$organization
    }

    mounted() {
        const parts = UrlHelper.shared.getParts()
        const urlParams = UrlHelper.shared.getSearchParams()

        if (urlParams.has("c")) {
            this.cycleOffset = parseInt(urlParams.get("c")!)
        }
                
        // Set url
        this.updateUrl()

        if (parts[parts.length - 1] === 'waiting-list' && !this.waitingList) {
            this.openWaitingList(false)
        } else {
            if (urlParams.has("member")) {
                this.openMemberOnLoad = urlParams.get("member")
            }

            UrlHelper.shared.clear()
        }
        this.reload();
    }

    updateUrl() {
        const params = new URLSearchParams()
        if (this.cycleOffset != 0) {
            params.set("c", this.cycleOffset.toString())
        }
        const queryString = params.toString() ? "?" + params.toString() : ""

        // Set url
        if (this.group) {
            UrlHelper.setUrl("/groups/"+Formatter.slug(this.group.settings.name) + (this.waitingList ? "/waiting-list" : "/members") + queryString)
            document.title = "Stamhoofd - "+this.group.settings.name
        } else {
            if (this.category) {
                UrlHelper.setUrl("/category/"+Formatter.slug(this.category.settings.name)+"/all" + (this.waitingList ? "/waiting-list" : "") + queryString)    
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
            return this.group.getMemberCount({
                waitingList: this.waitingList,
                cycleOffset: this.cycleOffset
            }) ?? 30;
        }

        if (this.category) {
            return this.category.getMemberCount({
                waitingList: this.waitingList,
                cycleOffset: this.cycleOffset
            }) ?? 30;
        }

        return 30
    }

    get waitingListSize() {
        if (this.cycleOffset != 0) {
            return 0
        }
        if (this.group) {
            return this.group.settings.waitingListSize;
        }
        if (this.category) {
            return this.category.groups.reduce((sum, group) => sum + (group.settings.waitingListSize ?? 0), 0)
        }
        return true;
    }

    get hasWaitingList() {
        if (this.cycleOffset != 0) {
            return true
        }
        if (this.group) {
            return this.group.settings.waitingListSize === null || this.group.settings.waitingListSize > 0;
        }
        if (this.category) {
            return !!this.category.groups.find((group) => group.settings.waitingListSize === null || group.settings.waitingListSize > 0)
        }
        return true;
    }
    
    get actions(): TableAction<MemberWithRegistrations>[] {
        const builder = new MemberActionBuilder({
            $organizationManager: this.$organizationManager,
            $memberManager: this.$memberManager,
            component: this,
            groups: this.groups,
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

        ]
    }

    getColumns(): Column<MemberWithRegistrations, any>[] {
        console.log('Updating all columns');

        if (this.cycleOffset) {
            // do nothing, but used to trigger update on cycle update
        }

        const cols: Column<MemberWithRegistrations, any>[] = [
            new Column<MemberWithRegistrations, string>({
                name: "Naam", 
                getValue: (v) => v.name, 
                compare: (a, b) => Sorter.byStringValue(a, b),
                minimumWidth: 100,
                recommendedWidth: 320,
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
                name: this.waitingList ? "Sinds" : "Inschrijvingsdatum", 
                getValue: (v) => {
                    const registrations = v.filterRegistrations({groups: this.groups, waitingList: this.waitingList, cycleOffset: this.cycleOffset})

                    if (registrations.length == 0) {
                        return null
                    }

                    const filtered = !this.waitingList ? registrations.filter(r => r.registeredAt).map(r => r.registeredAt!.getTime()) : registrations.map(r => r.createdAt!.getTime())

                    if (filtered.length == 0) {
                        return null
                    }
                    return new Date(Math.min(...filtered))
                }, 
                format: (v, width) => v ? (width < 160 ? (width < 120 ? Formatter.dateNumber(v, false) : Formatter.dateNumber(v, true)) : (width > 240 ? Formatter.dateTime(v) : Formatter.date(v, true))) : "Onbekend",
                getStyle: (v) => v === null ? "gray" : "",
                compare: (a, b) => Sorter.byDateValue(b ?? new Date(1900, 0, 1), a ?? new Date(1900, 0, 1)),
                minimumWidth: 80,
                recommendedWidth: 160
            })
        ]

        if (!this.waitingList) {
            cols.push(
                new Column<MemberWithRegistrations, number>({
                    name: "Openstaand saldo", 
                    getValue: (v) => v.outstandingBalance,
                    format: (outstandingBalance) => {
                        if (outstandingBalance < 0) {
                            return Formatter.price(outstandingBalance)
                        }
                        if (outstandingBalance <= 0) {
                            return "Betaald";
                        }
                        return Formatter.price(outstandingBalance)
                    }, 
                    getStyle: (v) => v <= 0 ? "gray" : "",
                    compare: (a, b) => Sorter.byNumberValue(b, a),
                    minimumWidth: 70,
                    recommendedWidth: 80
                })
            )
        }

        if (this.category) {
            cols.push(
                new Column<MemberWithRegistrations, Group[]>({
                    id: 'category',
                    name: this.waitingList ? 'Wachtlijst' : (this.category.settings.name || 'Groep'), 
                    getValue: (member) => {
                        if (!this.category) {
                            return [];
                        }
                        const groups = this.category.getAllGroups()
                        const registrations = member.filterRegistrations({groups: this.groups, waitingList: this.waitingList, cycleOffset: this.cycleOffset})
                        const memberGroups = registrations.flatMap(r => {
                            const group = groups.find(g => g.id == r.groupId)
                            if (!group) {
                                return []
                            }
                            return [group]
                        })
                        const getIndex = (g) => groups.findIndex(_g => _g.id === g.id)
                        return memberGroups.sort((a,b) => Sorter.byNumberValue(getIndex(b), getIndex(a)))
                    },
                    format: (groups) => {
                        if (groups.length == 0) {
                            return 'Geen'
                        }
                        return groups.map(g => g.settings.name).join(', ')
                    }, 
                    getStyle: (groups) => groups.length == 0 ? "gray" : "",
                    compare: (a, b) => {
                        if (!this.category) {
                            return 0;
                        }
                        const groups = this.category.getAllGroups()
                        const getIndex = (g) => groups.findIndex(_g => _g.id === g.id)
                        
                        for (let index = 0; index < Math.min(a.length, b.length); index++) {
                            const indexA = getIndex(a[index]);
                            const indexB = getIndex(b[index]);
                            if (indexA < indexB) {
                                return -1;
                            }
                            if (indexA > indexB) {
                                return 1;
                            }
                        }

                        // Equal
                        return b.length - a.length;
                    },
                    minimumWidth: 100,
                    recommendedWidth: 150
                })
            )
        }

        if (this.waitingList) {
            cols.push(
                new Column<MemberWithRegistrations, boolean>({
                    name: "Status", 
                    getValue: (member) => !!member.registrations.find(r => {
                        if (this.groupIds.includes(r.groupId) && r.waitingList && r.canRegister) {
                            const group = this.groups.find(g => g.id === r.groupId)
                            if (group && r.cycle == group.cycle - this.cycleOffset) {
                                return true;
                            }
                        }
                        return false;
                    }),
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

    }

    allColumns = this.getColumns()

    get title() {
        if (this.cycleOffset === 1) {
            return "Vorige inschrijvingsperiode"
        }

        if (this.cycleOffset > 1) {
            return this.cycleOffset+" inschrijvingsperiodes geleden"
        }

        return this.waitingList ? "Wachtlijst" : (this.group ? 'Leden' : (this.category && !this.isRoot ? this.category.settings.name : "Alle leden"))
    }

    get isRoot() {
        return this.category && this.category.id === this.organization.meta.rootCategoryId
    }

    get backHint() {
        return this.group ? this.group.settings.name : (this.category ? this.category.settings.name : "Alle leden")
    }

    get canGoBack() {
        return true
    }

    get canGoNext() {
        return this.cycleOffset > 0 && !this.loading
    }

    goNext() {
        this.cycleOffset--
        this.allColumns = this.getColumns()
        this.reload(true)
        this.updateUrl();
    }

    goBack() {
        this.cycleOffset++
        this.allColumns = this.getColumns()
        this.reload(true)
        this.updateUrl();
    }

    resetCycle() {
        this.cycleOffset = 0
        this.allColumns = this.getColumns()
        this.reload(true)
    }

    get hasWrite() {
        for (const group of this.groups) {
            if (!group.privateSettings || !group.hasWriteAccess(this.$context.organizationPermissions, this.organization)) {
                return false
            }
        }
        
        return true
    }

    get hasFull() {
        for (const group of this.groups) {
            if (!group.privateSettings || !group.hasFullAccess(this.$context.organizationPermissions, this.organization)) {
                return false
            }
        }
        
        return true
    }

    openMember(member: MemberWithRegistrations) {
        const table = this.$refs.table as TableView<MemberWithRegistrations> | undefined
        const component = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MemberSegmentedView, {
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
        // TODO: only show the record categories that are relevant for the given member (as soon as we implement filters)
        return this.$organization.meta.recordsConfiguration.recordCategories.flatMap(category => {
            if (category.childCategories.length > 0) {
                return category.childCategories
            }
            return [category]
        })
    }

    get records(): RecordSettings[] {
        // TODO: only show the record categories that are relevant for the given member (as soon as we implement filters)
        return this.recordCategories.flatMap(c => c.records)
    }

    created() {
        this.$memberManager.addListener(this, this.onUpdateMember)
    }

    activated() {
        
        GlobalEventBus.addListener(this, "encryption", async () => {
            this.reload()
            return Promise.resolve()
        })
    }

    addMemberIfInGroup(member: MemberWithRegistrations) {
        if (member.filterRegistrations({
            groups: this.groups,
            waitingList: this.waitingList,
            cycleOffset: this.cycleOffset
        }).length > 0) {
            this.allValues.push(member)
        }
    }

    removeMember(member: MemberWithRegistrations) {
        const index = this.allValues.findIndex(m => m.id === member.id)
        if (index >= 0) {
            this.allValues.splice(index, 1)
        }
    }

    onUpdateMember(type: MemberChangeEvent, member: MemberWithRegistrations | null) {
        if (type === "created" && member) {
            this.addMemberIfInGroup(member)
            return
        }

        if (type === "deleted" && member) {
            this.removeMember(member)
            return
        }

        if (type === "changedGroup" && member) {
            this.removeMember(member)
            this.addMemberIfInGroup(member)
            return
        }

        if (type === "updated" && member) {
            this.removeMember(member)
            this.addMemberIfInGroup(member)
            return
        }
    }

    deactivated() {
        GlobalEventBus.removeListener(this)
    }

    beforeUnmount() {
        this.$memberManager.removeListener(this)
        Request.cancelAll(this)
    }

    get groups() {
        if (this.group) {
            return [this.group]
        }
        if (this.category) {
            return this.category.getAllGroups()
        }
        return []
    }

    get groupIds() {
        if (this.group) {
            return [this.group.id]
        }
        if (this.category) {
            return this.category.getAllGroups().map(g => g.id) // needed because of permission check + existing check!
        }
        return []
    }

    reload(visibleReload = true) {
        Request.cancelAll(this)
        this.loading = visibleReload;
        this.$memberManager.loadMembers(this.groupIds, this.waitingList, this.cycleOffset, this).then((members) => {
            // Make sure we keep as many references as possible
            this.$memberManager.sync(this.allValues, members)
            this.allValues = members

            if (this.openMemberOnLoad) {
                const member = this.allValues.find(m => m.id === this.openMemberOnLoad);
                if (member) {
                    this.openMember(member)
                }
                this.openMemberOnLoad = null
            }
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
        //this.present(new ComponentWithProperties(NavigationController, {
        //    root: new ComponentWithProperties(EditMemberView, {
//
        //    })
        //}).setDisplayStyle("popup"))
    }

    openWaitingList(animated = true) {
        this.show({
            components: [
                new ComponentWithProperties(GroupMembersView, {
                    group: this.group,
                    category: this.category,
                    waitingList: true,
                    initialCycleOffset: this.cycleOffset
                })
            ],
            animated
        })
    }
}
</script>
