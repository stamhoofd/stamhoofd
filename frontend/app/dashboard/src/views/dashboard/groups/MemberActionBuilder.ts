import { ComponentWithProperties, NavigationController } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, CenteredMessageButton, LoadComponent, TableAction, Toast } from "@stamhoofd/components";
import { EncryptedMemberWithRegistrations, Group, GroupCategoryTree, MemberWithRegistrations, Registration } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";

import { MemberManager } from "../../../classes/MemberManager";
import { OrganizationManager } from "../../../classes/OrganizationManager";
import MailView from "../mail/MailView.vue";
import EditMemberView from "../member/edit/EditMemberView.vue";
import SMSView from "../sms/SMSView.vue";


export class MemberActionBuilder {
    component: any
    groups: Group[]
    cycleOffset: number
    hasWrite: boolean
    inWaitingList = false

    constructor(settings: {
        component: any,
        hasWrite: boolean,
        cycleOffset: number,
        groups: Group[],
        inWaitingList?: boolean
    }) {
        this.component = settings.component
        this.hasWrite = settings.hasWrite
        this.cycleOffset = settings.cycleOffset
        this.groups = settings.groups
        this.inWaitingList = settings.inWaitingList ?? false
    }

    getRegisterActions(cycleOffset?: number): TableAction<MemberWithRegistrations>[] {
        if (cycleOffset === undefined) {
            return [
                ...this.getRegisterActions(0),
                new TableAction({
                    name: "Vorige inschrijvingsperiode van",
                    groupIndex: 0,
                    childActions: () => [
                        ...this.getRegisterActions(1),
                    ]
                }),
            ]
        }

        if(cycleOffset === 0) {
            return [
                new TableAction({
                    name: "Wachtlijst van",
                    groupIndex: 0,
                    childActions: () => [
                        ...this.getActionsForCategory(OrganizationManager.organization.adminCategoryTree, (members, group) => this.register(members, group, group.cycle, true))
                    ]
                }),
                ...this.getActionsForCategory(OrganizationManager.organization.adminCategoryTree, (members, group) => this.register(members, group, group.cycle, false))
            ]
        }

        return [
            ...this.getActionsForCategory(OrganizationManager.organization.adminCategoryTree, (members, group) => this.register(members, group, group.cycle - cycleOffset, false))
        ]
    }

    getMoveAction(): TableAction<MemberWithRegistrations> {
        return new TableAction({
            name: this.inWaitingList ? "Verplaats naar wachtlijst" : "Verplaatsen naar",
            priority: 1,
            groupIndex: 5,
            needsSelection: true,
            allowAutoSelectAll: false,
            enabled: this.hasWrite,
            childActions: () => [
                new TableAction({
                    name: "Huidige inschrijvingsperiode",
                    groupIndex: 0,
                    enabled: this.cycleOffset >= 1 || (this.inWaitingList && this.cycleOffset !== 0),
                    handler: (members) => {
                        this.moveCycle(members, 0)
                    }
                }),
                new TableAction({
                    name: "Vorige inschrijvingsperiode",
                    groupIndex: 0,
                    enabled: this.cycleOffset !== 1,
                    handler: (members) => {
                        this.moveCycle(members, 1)
                    }
                }),
                new TableAction({
                    name: (this.cycleOffset + 1) + " inschrijvingsperiodes geleden",
                    groupIndex: 0,
                    enabled: this.cycleOffset >= 1,
                    handler: (members) => {
                        this.moveCycle(members, this.cycleOffset + 1)
                    }
                }),
                new TableAction({
                    name: (this.cycleOffset - 1) + " inschrijvingsperiodes geleden",
                    groupIndex: 0,
                    enabled: this.cycleOffset > 2,
                    handler: (members) => {
                        this.moveCycle(members, this.cycleOffset - 1)
                    }
                }),
                new TableAction({
                    name: "Wachtlijst",
                    groupIndex: 0,
                    enabled: !this.inWaitingList,
                    handler: (members) => {
                        this.moveToWaitingList(members)
                    }
                }),
                ...this.getActionsForCategory(OrganizationManager.organization.adminCategoryTree, (members, group) => this.moveRegistrations(members, group))
            ]
        })
    }

    getUnsubscribeAction(): TableAction<MemberWithRegistrations> {
        return new TableAction({
            name: "Uitschrijven",
            priority: 0,
            groupIndex: 7,
            needsSelection: true,
            allowAutoSelectAll: false,
            enabled: this.hasWrite,
            handler: (members) => {
                this.deleteRegistration(members)
            }
        });
    }

    getActionsForCategory(category: GroupCategoryTree, action: (members: MemberWithRegistrations[], group: Group) => void) {
        return [
            ...category.categories.map(c => {
                return new TableAction({
                    name: c.settings.name,
                    groupIndex: 2,
                    needsSelection: true,
                    allowAutoSelectAll: false,
                    enabled: c.groups.length > 0 || c.categories.length > 0,
                    childActions: () => this.getActionsForCategory(c, action),
                })
            }),
            ...category.groups.map(g => {
                return new TableAction({
                    name: g.settings.name,
                    needsSelection: true,
                    allowAutoSelectAll: false,
                    handler: (members: MemberWithRegistrations[]) => {
                        action(members, g)
                        //this.moveRegistrations(members, g)
                    }
                })
            })
        ];
    }

    getActions(): TableAction<MemberWithRegistrations>[] {
        return [
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
                        name: "Excel...",
                        priority: 0,
                        groupIndex: 0,
                        handler: async (members: MemberWithRegistrations[]) => {
                        // TODO: vervangen door een context menu
                            await this.exportToExcel(members)
                        }
                    }),
                    new TableAction({
                        name: "PDF...",
                        priority: 0,
                        groupIndex: 0,
                        handler: async (members: MemberWithRegistrations[]) => {
                        // TODO: vervangen door een context menu
                            await this.exportToPDF(members)
                        }
                    }),
                ]
            }),
            new TableAction({
                name: "Inschrijven voor",
                priority: 1,
                groupIndex: 5,
                needsSelection: true,
                allowAutoSelectAll: false,
                enabled: this.hasWrite,
                childActions: () => this.getRegisterActions()
            }),
            // Waiting list actions
            this.getMoveAction(),

            this.getUnsubscribeAction(),

            new TableAction({
                name: "Gegevens gedeeltelijk wissen",
                priority: 0,
                groupIndex: 7,
                needsSelection: true,
                allowAutoSelectAll: false,
                enabled: this.hasWrite,
                handler: (members) => {
                    this.deleteRecords(members)
                }
            }),

            new TableAction({
                name: "Overal verwijderen",
                icon: "trash",
                priority: 0,
                groupIndex: 7,
                needsSelection: true,
                allowAutoSelectAll: false,
                enabled: this.hasWrite,
                handler: (members) => {
                    this.deleteData(members)
                }
            }),
        ]
    }

    /**
     * Actions for manipulating the waiting list. waitingList indicated whether we are in the waiting list or not
     */
    getWaitingListActions(): TableAction<MemberWithRegistrations>[] {
        return [
            //
            new TableAction({
                name: "Toelaten om in te schrijven",
                icon: "success",
                priority: 15,
                groupIndex: 6,
                enabled: this.hasWrite && this.inWaitingList  && this.cycleOffset == 0,
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
                groupIndex: 6,
                enabled: this.hasWrite && this.inWaitingList && this.cycleOffset == 0,
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (members: MemberWithRegistrations[]) => {
                    await this.return(members, false)
                }
            }),

            // Waiting list actions
            /*new TableAction({
                name: "Verplaatst naar wachtlijst",
                priority: 0,
                groupIndex: 5,
                needsSelection: true,
                allowAutoSelectAll: false,
                enabled: !this.inWaitingList && this.hasWrite,
                handler: (members) => {
                    this.moveToWaitingList(members)
                }
            }),*/

            new TableAction({
                name: "Verplaats naar ingeschreven leden",
                priority: 1,
                groupIndex: 5,
                needsSelection: true,
                allowAutoSelectAll: false,
                enabled: this.inWaitingList && this.hasWrite,
                handler: (members) => {
                    this.acceptWaitingList(members)
                }
            }),
        ]
    }

    present(component: ComponentWithProperties) {
        this.component.present(component);
    }

    // Action implementations
    openMail(members: MemberWithRegistrations[], subject = "") {
        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MailView, {
                members,
                group: this.groups.length === 1 ? this.groups[0] : undefined,
                defaultSubject: subject,
                defaultReplacements: OrganizationManager.organization.meta.getEmailReplacements()
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

    async exportToExcel(members: MemberWithRegistrations[]) {
        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: await LoadComponent(() => import(/* webpackChunkName: "MemberExcelBuilderView"*/ '../member/MemberExcelBuilderView.vue'), {
                members,
                groups: this.groups,
                waitingList: this.inWaitingList,
                cycleOffset: this.cycleOffset
            })
        });
        this.present(displayedComponent.setDisplayStyle("popup"));
    }

    async exportToPDF(members: MemberWithRegistrations[]) {
        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: await LoadComponent(() => import(/* webpackChunkName: "MemberSummaryBuilderView"*/ '../member/MemberSummaryBuilderView.vue'), {
                members,
                group: this.groups.length === 1 ? this.groups[0] : undefined,
            })
        });
        this.present(displayedComponent.setDisplayStyle("popup"));
    }

    deleteRecords(members: MemberWithRegistrations[]) {
        const member = members.length == 1 ? members[0].name : members.length+" leden"
        new CenteredMessage(`Gegevens van ${member} wissen`, "Opgelet, je kan dit niet ongedaan maken! Deze functie houdt de leden wel in het systeem, maar verwijdert een deel van de gegevens (o.a. handig om in orde te zijn met GDPR).")
            .addButton(new CenteredMessageButton("Behoud contactgegevens", {
                action: async () => {
                    if (await CenteredMessage.confirm("Ben je zeker?", "Verwijder", "Alle gegevens van deze leden, met uitzondering van hun voor- en achternaam, e-mailadres en telefoonnummer (van leden zelf en ouders indien -18jaar) worden verwijderd.")) {
                        await MemberManager.deleteDataExceptContacts(members)
                        new Toast(`De gegevens van ${member} zijn verwijderd.`, "success green").show()
                    }
                },
                type: "destructive",
                icon: "trash"
            }))
            .addButton(new CenteredMessageButton("Behoud enkel naam", {
                action: async () => {
                    if (await CenteredMessage.confirm("Ben je zeker?", "Verwijder", "Alle gegevens van deze leden, met uitzondering van hun voor- en achternaam worden verwijderd.")) {
                        await MemberManager.deleteData(members)
                        new Toast(`De gegevens van ${member} zijn verwijderd.`, "success green").show()
                    }
                },
                type: "destructive",
                icon: "trash"
            }))
            .addCloseButton("Annuleren")
            .show()
    }

    deleteData(members: MemberWithRegistrations[]) {
        const member = members.length == 1 ? members[0].name : members.length+" leden"
        new CenteredMessage(`${member} definitief verwijderen?`, "Je kan dit niet ongedaan maken. Je verliest alle gegevens, betaalgegevens, accounts...")
            .addButton(new CenteredMessageButton("Verwijderen", {
                action: () => {
                    CenteredMessage.confirm("Begrijp je dat dit alles verwijdert?", "Ja, verwijderen", 'Alle inschrijvingen, betaalgegevens, gegevens en accounts gaan verloren.').then(async (confirmed) => {
                        if (confirmed) {
                            await MemberManager.deleteMembers(members)
                            new Toast(`${member} ${members.length > 1 ? 'zijn' : 'is'} verwijderd`, "success green").show()
                        }
                    }).catch(console.error)
                    return Promise.resolve()
                },
                type: "destructive",
                icon: "trash"
            }))
            .addCloseButton("Annuleren")
            .show()
    }

    deleteRegistration(members: MemberWithRegistrations[]) {
        const member = members.length == 1 ? members[0].name : members.length+" leden"
        new CenteredMessage(`${member} uitschrijven?`, `Hiermee verwijder je alleen de inschrijvingen bij ${Formatter.joinLast(this.groups.map(g => g.settings.name), ', ', ' of ')}. Andere inschrijvingen en gegevens van ${member} blijven behouden.`)
            .addButton(new CenteredMessageButton("Uitschrijven", {
                action: () => {
                    (async () => {
                        if (members.length == 1 || await CenteredMessage.confirm("Ben je echt heel zeker?", "Ja, uitschrijven")) {
                            await MemberManager.unregisterMembers(members, this.groups, this.cycleOffset, this.inWaitingList)
                            new Toast(`${member} ${members.length > 1 ? 'zijn' : 'is'} uitgeschreven`, "success green").show()
                        }
                    })().catch(console.error)
                    return Promise.resolve()
                },
                type: "destructive",
                icon: "unregister"
            }))
            .addCloseButton("Annuleren")
            .show()
    }

    get groupIds() {
        return this.groups?.map(g => g.id) ?? []
    }
  
    async return(members: MemberWithRegistrations[], allow = true) {
        members = members.filter(m => {
            const regs = m.filterRegistrations({groups: this.groups, waitingList: true, cycleOffset: this.cycleOffset, canRegister: !allow})
            console.log(regs, this.groups, this.cycleOffset, allow)
            return regs.length > 0
        })
        if (members.length == 0) {
            return;
        }

        try {
            const patches = MemberManager.getPatchArray()
            for (const member of members) {
                const registrationsPatch = MemberManager.getRegistrationsPatchArray()

                const registrations = member.filterRegistrations({groups: this.groups, waitingList: true, cycleOffset: this.cycleOffset, canRegister: !allow})

                for (const registration of registrations) {
                    registrationsPatch.addPatch(Registration.patch({
                        id: registration.id,
                        canRegister: allow
                    }))
                }

                patches.addPatch(EncryptedMemberWithRegistrations.patch({
                    id: member.id,
                    registrations: registrationsPatch
                }))
            }
            await MemberManager.patchMembersAndSync(members, patches, false)
        } catch (e) {
            console.error(e)
            Toast.fromError(e).show()
            return
        }

        if (allow) {
            new Toast("Verstuur zeker nog zelf een uitnodigingsmail", "success green").show()
        } else {
            new Toast("Uitnodiging geannuleerd", "success green").show()
        }
    }

    acceptWaitingList(members: MemberWithRegistrations[]) {
        const member = members.length == 1 ? members[0].name : members.length+" leden"
        new CenteredMessage(`${member} inschrijven?`, "We raden sterk aan om leden toe te laten en daarna uit te nodigen om in te schrijven via een e-mail. Dan zijn ze verplicht om de rest van hun gegevens aan te vullen en de betaling in orde te brengen.")
            .addButton(new CenteredMessageButton("Ja, inschrijven", {
                action: async () => {
                    await MemberManager.acceptFromWaitingList(members, this.groups, this.cycleOffset)
                    new Toast(members.length+" leden zijn ingeschreven", "success green").show()
                },
                type: "destructive",
                icon: "download"
            }))
            .addCloseButton("Annuleren")
            .show()
    }

    moveToWaitingList(members: MemberWithRegistrations[]) {
        const member = members.length == 1 ? members[0].name : members.length+" leden"
        new CenteredMessage(`${member} naar de wachtlijst verplaatsen?`)
            .addButton(new CenteredMessageButton("Ja, verplaats", {
                action: async () => {
                    await MemberManager.moveToWaitingList(members, this.groups, this.cycleOffset)
                    new Toast(members.length+" leden zijn naar de wachtlijst verplaatst", "success green").show()
                },
                icon: "clock"
            }))
            .addCloseButton("Annuleren")
            .show()
    }

    moveRegistrations(members: MemberWithRegistrations[], group: Group) {
        const member = members.length == 1 ? members[0].name : members.length+" leden"
        new CenteredMessage(`${member} verplaatsen naar ${group.settings.name}?`)
            .addButton(new CenteredMessageButton("Ja, verplaats", {
                action: async () => {
                    await MemberManager.moveRegistrations(members, this.groups, this.cycleOffset, this.inWaitingList, group)
                    new Toast(members.length+` leden zijn naar ${group.settings.name} verplaatst`, "success green").show()
                },
                icon: "sync"
            }))
            .addCloseButton("Annuleren")
            .show()
    }

    register(members: MemberWithRegistrations[], group: Group, cycle: number, waitingList: boolean) {
        const member = members.length == 1 ? members[0].name : members.length+" leden"
        let periodText = '';

        if (cycle !== group.cycle) {
            const offset = group.cycle - cycle;
            if (offset === 1) {
                periodText = ' (vorige periode)';
            } else {
                periodText = ` (${offset} periodes geleden)`;
            }
        }

        new CenteredMessage(waitingList ? `${member} op wachtlijst plaatsen van ${group.settings.name}${periodText}?` : `${member} inschrijven voor ${group.settings.name}${periodText}?`)
            .addButton(new CenteredMessageButton("Ja, inschrijven", {
                action: async () => {
                    const n = members.length == 1 ? members[0].name + ' is' : members.length+" leden zijn"
                    await MemberManager.registerMembers(members, group, cycle, waitingList)
                    new Toast(waitingList ? n+` op de wachtlijst geplaatst voor ${group.settings.name}${periodText}` : n + ` ingeschreven voor ${group.settings.name}${periodText}`, "success green").show()
                }
            }))
            .addCloseButton("Annuleren")
            .show()
    }

    moveCycle(members: MemberWithRegistrations[], cycleOffset: number) {
        const member = members.length == 1 ? members[0].name : members.length+" leden"
        let cycleName = 'de huidige inschrijvingsperiode';

        if (cycleOffset === 1) {
            cycleName = 'de vorige inschrijvingsperiode';
        }
        else if (cycleOffset >= 2) {
            cycleName = cycleOffset + ' inschrijvingsperiodes geleden';
        }

        new CenteredMessage(`${member} verplaatsen naar ${cycleName}?`)
            .addButton(new CenteredMessageButton("Ja, verplaats", {
                action: async () => {
                    await MemberManager.moveCycle(members, this.groups, this.cycleOffset, this.inWaitingList, cycleOffset)
                    new Toast(members.length+` leden zijn naar ${cycleName} verplaatst`, "success green").show()
                },
                icon: "sync"
            }))
            .addCloseButton("Annuleren")
            .show()
    }

}