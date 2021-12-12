<template>
    <TableView :title="title" :column-configuration-id="waitingList ? 'members-waiting-list' : 'members'" :actions="actions" :all-values="allValues" :estimated-rows="estimatedRows" :all-columns="allColumns" :filter-definitions="filterDefinitions" @click="openMember">
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
import { BackButton, CenteredMessage, CenteredMessageButton, Checkbox, Column, GlobalEventBus, LoadingButton, SegmentedControl, Spinner, STNavigationBar, STNavigationTitle, STToolbar, TableAction, TableView, Toast, TooltipDirective as Tooltip } from "@stamhoofd/components";
import { UrlHelper } from "@stamhoofd/networking";
import { ChoicesFilterChoice, ChoicesFilterDefinition, ChoicesFilterMode, EncryptedMemberWithRegistrationsPatch, getPermissionLevelNumber, Group, GroupCategoryTree, MemberWithRegistrations, Organization, PermissionLevel, RecordCategory, RecordCheckboxAnswer, RecordChooseOneAnswer, RecordMultipleChoiceAnswer, RecordSettings, RecordTextAnswer, RecordType, Registration, StringFilterDefinition } from '@stamhoofd/structures';
import { Formatter, Sorter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { MemberChangeEvent, MemberManager } from "../../../classes/MemberManager";
import { OrganizationManager } from "../../../classes/OrganizationManager";
import MailView from "../mail/MailView.vue";
import EditMemberView from "../member/edit/EditMemberView.vue";
import MemberSummaryBuilderView from "../member/MemberSummaryBuilderView.vue";
import MemberView from "../member/MemberView.vue";
import BillingWarningBox from "../settings/packages/BillingWarningBox.vue";
import SMSView from "../sms/SMSView.vue";
import EditCategoryGroupsView from "./EditCategoryGroupsView.vue";
import EditGroupView from "./EditGroupView.vue";

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
            return this.group.settings.registeredMembers ?? 30
        }

        if (this.category) {
            return this.category.groups.reduce((sum, group) => sum + (group.settings.registeredMembers ?? 30), 0)
        }

        return 30
    }
    
    get actions(): TableAction<MemberWithRegistrations>[] {
        return [
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
                name: "Bewerk",
                icon: "edit",
                priority: 0,
                groupIndex: 1,
                needsSelection: true,
                singleSelection: true,
                enabled: this.hasWrite,
                handler: (members: MemberWithRegistrations[]) => {
                    this.editMember(members[0])
                }
            }),

            new TableAction({
                name: "Open wachtlijst",
                icon: "clock",
                priority: 0,
                groupIndex: 2,
                needsSelection: false,
                enabled: !this.waitingList && !!this.group,
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
        
            //
            new TableAction({
                name: "Toelaten om in te schrijven",
                icon: "success",
                priority: 15,
                groupIndex: 3,
                enabled: this.hasWrite && this.waitingList,
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (members: MemberWithRegistrations[]) => {
                    await this.return(members, true)
                }
            }),

            new TableAction({
                name: "Toelating intrekken",
                icon: "canceled",
                priority: 14,
                groupIndex: 3,
                enabled: this.hasWrite && this.waitingList,
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (members: MemberWithRegistrations[]) => {
                    await this.return(members, false)
                }
            }),

            new TableAction({
                name: "E-mailen",
                icon: "email",
                priority: 10,
                groupIndex: 3,
                handler: (members: MemberWithRegistrations[]) => {
                    this.openMail(members)
                }
            }),
            new TableAction({
                name: "SMS'en",
                icon: "feedback-line",
                priority: 9,
                groupIndex: 3,

                handler: (members: MemberWithRegistrations[]) => {
                    this.openSMS(members)
                }
            }),
            new TableAction({
                name: "Exporteren naar",
                icon: "download",
                priority: 8,
                groupIndex: 3,
                childActions: [
                    new TableAction({
                        name: "Excel",
                        priority: 0,
                        groupIndex: 0,
                        handler: (members: MemberWithRegistrations[]) => {
                        // todo: vervangen door een context menu
                            this.exportToExcel(members).catch(console.error)
                        }
                    }),
                    new TableAction({
                        name: "PDF...",
                        priority: 0,
                        groupIndex: 0,
                        handler: (members: MemberWithRegistrations[]) => {
                        // todo: vervangen door een context menu
                            this.exportToPDF(members)
                        }
                    }),
                ]
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

            // Waiting list actions
            new TableAction({
                name: "Verplaatst naar wachtlijst",
                priority: 0,
                groupIndex: 5,
                needsSelection: true,
                allowAutoSelectAll: false,
                enabled: !this.waitingList && this.hasWrite,
                handler: (members) => {
                    this.moveToWaitingList(members)
                }
            }),

            new TableAction({
                name: "Schrijf in",
                priority: 0,
                groupIndex: 5,
                needsSelection: true,
                allowAutoSelectAll: false,
                enabled: this.waitingList && this.hasWrite,
                handler: (members) => {
                    this.acceptWaitingList(members)
                }
            }),

            new TableAction({
                name: "Uitschrijven",
                priority: 0,
                groupIndex: 5,
                needsSelection: true,
                allowAutoSelectAll: false,
                enabled: this.hasWrite,
                handler: (members) => {
                    this.deleteRegistration(members)
                }
            }),


            new TableAction({
                name: "Gegevens gedeeltelijk wissen...",
                priority: 0,
                groupIndex: 5,
                needsSelection: true,
                allowAutoSelectAll: false,
                enabled: this.hasWrite,
                handler: (members) => {
                    this.deleteRecords(members)
                }
            }),

            new TableAction({
                name: "Verwijderen",
                icon: "trash",
                priority: 0,
                groupIndex: 5,
                needsSelection: true,
                allowAutoSelectAll: false,
                enabled: this.hasWrite,
                handler: (members) => {
                    this.deleteData(members)
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
                recommendedWidth: 300
            }),
            new Column<MemberWithRegistrations, string>({
                name: "Voornaam", 
                getValue: (v) => v.firstName, 
                compare: (a, b) => Sorter.byStringValue(a, b),
                enabled: false,
                minimumWidth: 100,
                recommendedWidth: 150
            }),
            new Column<MemberWithRegistrations, string>({
                name: "Achternaam", 
                getValue: (v) => v.details.lastName, 
                compare: (a, b) => Sorter.byStringValue(a, b),
                enabled: false,
                minimumWidth: 100,
                recommendedWidth: 150
            }),
            new Column<MemberWithRegistrations, number | null>({
                name: "Leeftijd", 
                getValue: (v) => v.details.age, 
                format: (v) => v !== null ? v+" jaar" : "Geen leeftijd", 
                getStyle: (v) => v === null ? "gray" : "",
                compare: (a, b) => Sorter.byNumberValue(b ?? 99, a ?? 99),
                minimumWidth: 100,
                recommendedWidth: 150
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
                format: (v) => v ? Formatter.date(v, true) : "Onbekend",
                getStyle: (v) => v === null ? "gray" : "",
                compare: (a, b) => Sorter.byDateValue(b ?? new Date(1900, 0, 1), a ?? new Date(1900, 0, 1)),
                minimumWidth: 100,
                recommendedWidth: 150
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
                    minimumWidth: 100,
                    recommendedWidth: 150
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
        const component = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MemberView, {
                member: member,
                // eslint-disable-next-line @typescript-eslint/unbound-method
                //getNextMember: this.getNextMember,
                // eslint-disable-next-line @typescript-eslint/unbound-method
                //getPreviousMember: this.getPreviousMember,

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

    openMail(members: MemberWithRegistrations[], subject = "") {
        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MailView, {
                members,
                group: this.group,
                defaultSubject: subject
            })
        });
        this.present(displayedComponent.setDisplayStyle("popup"));
    }

    openSMS(members: MemberWithRegistrations[]) {
        const displayedComponent = new ComponentWithProperties(SMSView, {
            members,
        });
        this.present(displayedComponent.setDisplayStyle("popup"));
    }

    editMember(member: MemberWithRegistrations) {
        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(EditMemberView, {
                member,
            })
        });
        this.present(displayedComponent.setDisplayStyle("popup"));
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

    async exportToExcel(members: MemberWithRegistrations[]) {
        try {
            const d = await import(/* webpackChunkName: "MemberExcelExport" */ "../../../classes/MemberExcelExport");
            const MemberExcelExport = d.MemberExcelExport
            MemberExcelExport.export(members);
        } catch (e) {
            console.error(e)
            Toast.fromError(e).show()
        }
    }

    exportToPDF(members: MemberWithRegistrations[]) {
        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MemberSummaryBuilderView, {
                members,
                group: this.group
            })
        });
        this.present(displayedComponent.setDisplayStyle("popup"));
    }

    async return(members: MemberWithRegistrations[], allow = true) {
        members = members.filter(m => !this.group || (allow && m.waitingGroups.find(r => r.id === this.group!.id)) || (!allow && m.acceptedWaitingGroups.find(r => r.id === this.group!.id)))
        if (members.length == 0) {
            return;
        }

        try {
            const patches = MemberManager.getPatchArray()
            for (const member of members) {
                const registrationsPatch = MemberManager.getRegistrationsPatchArray()

                const registration = member.registrations.find(r => r.groupId == this.group!.id && r.waitingList == true && r.cycle == this.group!.cycle)
                if (!registration) {
                    throw new Error("Not found")
                }
                registrationsPatch.addPatch(Registration.patchType().create({
                    id: registration.id,
                    canRegister: allow
                }))

                patches.addPatch(EncryptedMemberWithRegistrationsPatch.create({
                    id: member.id,
                    registrations: registrationsPatch
                }))
            }
            await MemberManager.patchMembers(patches)
        } catch (e) {
            console.error(e)
            // todo
        }
        this.reload()

        if (allow) {
            this.openMail(members, "Je kan nu inschrijven!")
        }
    }

    acceptWaitingList(members: MemberWithRegistrations[]) {
        new CenteredMessage("Wil je "+members.length+" leden inschrijven?", "We raden sterk aan om leden toe te laten en daarna uit te nodigen om in te schrijven via een e-mail. Dan zijn ze verplicht om de rest van hun gegevens aan te vullen en de betaling in orde te brengen.")
            .addButton(new CenteredMessageButton("Toch inschrijven", {
                action: async () => {
                    await MemberManager.acceptFromWaitingList(members, this.group, this.cycleOffset)
                    new Toast(members.length+" leden zijn ingeschreven", "success green").show()
                },
                type: "destructive",
                icon: "download"
            }))
            .addCloseButton("Annuleren")
            .show()
    }

    deleteRecords(members: MemberWithRegistrations[]) {
        new CenteredMessage("Gegevens van "+members.length+" leden wissen", "Opgelet, je kan dit niet ongedaan maken! Deze functie houdt de leden wel in het systeem, maar verwijdert een deel van de gegevens (o.a. handig om in orde te zijn met GDPR).")
            .addButton(new CenteredMessageButton("Behoud contactgegevens", {
                action: async () => {
                    if (await CenteredMessage.confirm("Ben je zeker?", "Verwijder", "Alle gegevens van deze leden, met uitzondering van hun voor- en achternaam, e-mailadres en telefoonnummer (van leden zelf en ouders indien -18jaar) worden verwijderd.")) {
                        await MemberManager.deleteDataExceptContacts(members)
                        new Toast("De steekkaart van "+members.length+" leden is verwijderd.", "success green").show()
                    }
                },
                type: "destructive",
                icon: "trash"
            }))
            .addButton(new CenteredMessageButton("Behoud enkel naam", {
                action: async () => {
                    if (await CenteredMessage.confirm("Ben je zeker?", "Verwijder", "Alle gegevens van deze leden, met uitzondering van hun voor- en achternaam worden verwijderd.")) {
                        await MemberManager.deleteData(members)
                        new Toast("De steekkaart van "+members.length+" leden is verwijderd.", "success green").show()
                    }
                },
                type: "destructive",
                icon: "trash"
            }))
            .addCloseButton("Annuleren")
            .show()
    }

    moveToWaitingList(members: MemberWithRegistrations[]) {
        new CenteredMessage("Wil je "+members.length+" leden naar de wachtlijst verplaatsen?")
            .addButton(new CenteredMessageButton("Naar wachtlijst", {
                action: async () => {
                    await MemberManager.moveToWaitingList(members, this.group, this.cycleOffset)
                    new Toast(members.length+" leden zijn naar de wachtlijst verplaatst", "success green").show()
                },
                type: "destructive",
                icon: "clock"
            }))
            .addCloseButton("Annuleren")
            .show()
    }

    deleteData(members: MemberWithRegistrations[]) {
        new CenteredMessage("Wil je alle data van "+members.length+" leden verwijderen?", "Dit verwijdert alle data van de geselecteerde leden, inclusief betalingsgeschiedenis. Als er accounts zijn die enkel aangemaakt zijn om dit lid in te schrijven worden deze ook verwijderd. Je kan dit niet ongedaan maken.")
            .addButton(new CenteredMessageButton("Verwijderen", {
                action: async () => {
                    if (await CenteredMessage.confirm("Ben je echt heel zeker?", "Ja, definitief verwijderen")) {
                        await MemberManager.deleteMembers(members)
                        new Toast(members.length+" leden zijn verwijderd", "success green").show()
                    }
                },
                type: "destructive",
                icon: "trash"
            }))
            .addCloseButton("Annuleren")
            .show()
    }

    deleteRegistration(members: MemberWithRegistrations[]) {
        new CenteredMessage("Ben je zeker dat je "+members.length+" leden wilt uitschrijven?", "De gegevens van de leden blijven (tijdelijk) toegankelijk voor het lid zelf en die kan zich later eventueel opnieuw inschrijven zonder alles opnieuw in te geven.")
            .addButton(new CenteredMessageButton("Uitschrijven", {
                action: async () => {
                    if (await CenteredMessage.confirm("Ben je echt heel zeker?", "Ja, uitschrijven")) {
                        await MemberManager.unregisterMembers(members, this.group, this.cycleOffset, this.waitingList)
                        new Toast(members.length+" leden zijn uitgeschreven", "success green").show()
                    }
                },
                type: "destructive",
                icon: "unregister"
            }))
            .addCloseButton("Annuleren")
            .show()
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
