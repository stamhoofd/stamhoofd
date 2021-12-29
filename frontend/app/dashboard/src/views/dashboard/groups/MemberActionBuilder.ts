import { ComponentWithProperties, NavigationController } from "@simonbackx/vue-app-navigation"
import { CenteredMessage, CenteredMessageButton, LoadComponent, TableAction, Toast } from "@stamhoofd/components"
import { EncryptedMemberWithRegistrationsPatch, Group, MemberWithRegistrations, Registration } from "@stamhoofd/structures"

import { MemberManager } from "../../../classes/MemberManager"
import MailView from "../mail/MailView.vue";
import EditMemberView from "../member/edit/EditMemberView.vue";
import SMSView from "../sms/SMSView.vue";

export class MemberActionBuilder {
    component: any
    group?: Group
    cycleOffset: number
    hasWrite: boolean
    inWaitingList = false

    constructor(settings: {
        component: any,
        hasWrite: boolean,
        cycleOffset: number,
        group?: Group | null,
        inWaitingList?: boolean
    }) {
        this.component = settings.component
        this.hasWrite = settings.hasWrite
        this.cycleOffset = settings.cycleOffset
        this.group = settings.group ?? undefined
        this.inWaitingList = settings.inWaitingList ?? false
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
                        name: "Excel",
                        priority: 0,
                        groupIndex: 0,
                        handler: async (members: MemberWithRegistrations[]) => {
                        // todo: vervangen door een context menu
                            await this.exportToExcel(members)
                        }
                    }),
                    new TableAction({
                        name: "PDF...",
                        priority: 0,
                        groupIndex: 0,
                        handler: async (members: MemberWithRegistrations[]) => {
                        // todo: vervangen door een context menu
                            await this.exportToPDF(members)
                        }
                    }),
                ]
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
                groupIndex: 3,
                enabled: this.hasWrite && this.inWaitingList,
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
                enabled: this.hasWrite && this.inWaitingList,
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (members: MemberWithRegistrations[]) => {
                    await this.return(members, false)
                }
            }),

            // Waiting list actions
            new TableAction({
                name: "Verplaatst naar wachtlijst",
                priority: 0,
                groupIndex: 5,
                needsSelection: true,
                allowAutoSelectAll: false,
                enabled: !this.inWaitingList && this.hasWrite,
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

    async exportToPDF(members: MemberWithRegistrations[]) {
        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: await LoadComponent(() => import(/* webpackChunkName: "MemberSummaryBuilderView"*/ '../member/MemberSummaryBuilderView.vue'), {
                members,
                group: this.group
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
        new CenteredMessage(`Wil je alle data van ${member} verwijderen?`, "Dit verwijdert alle data van de geselecteerde leden, inclusief betalingsgeschiedenis. Als er accounts zijn die enkel aangemaakt zijn om dit lid in te schrijven worden deze ook verwijderd. Je kan dit niet ongedaan maken.")
            .addButton(new CenteredMessageButton("Verwijderen", {
                action: async () => {
                    if (await CenteredMessage.confirm("Ben je echt heel zeker?", "Ja, definitief verwijderen")) {
                        await MemberManager.deleteMembers(members)
                        new Toast(`${member} ${members.length > 1 ? 'zijn' : 'is'} verwijderd`, "success green").show()
                    }
                },
                type: "destructive",
                icon: "trash"
            }))
            .addCloseButton("Annuleren")
            .show()
    }

    deleteRegistration(members: MemberWithRegistrations[]) {
        const member = members.length == 1 ? members[0].name : members.length+" leden"
        new CenteredMessage(`Ben je zeker dat je ${member} wilt uitschrijven?`, "De gegevens van de leden blijven (tijdelijk) toegankelijk voor het lid zelf en die kan zich later eventueel opnieuw inschrijven zonder alles opnieuw in te geven.")
            .addButton(new CenteredMessageButton("Uitschrijven", {
                action: async () => {
                    if (await CenteredMessage.confirm("Ben je echt heel zeker?", "Ja, uitschrijven")) {
                        await MemberManager.unregisterMembers(members, this.group, this.cycleOffset, this.inWaitingList)
                        new Toast(`${member} ${members.length > 1 ? 'zijn' : 'is'} uitgeschreven`, "success green").show()
                    }
                },
                type: "destructive",
                icon: "unregister"
            }))
            .addCloseButton("Annuleren")
            .show()
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
        new CenteredMessage(`Wil je ${member} inschrijven?`, "We raden sterk aan om leden toe te laten en daarna uit te nodigen om in te schrijven via een e-mail. Dan zijn ze verplicht om de rest van hun gegevens aan te vullen en de betaling in orde te brengen.")
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

    moveToWaitingList(members: MemberWithRegistrations[]) {
        const member = members.length == 1 ? members[0].name : members.length+" leden"
        new CenteredMessage(`Wil je ${member} naar de wachtlijst verplaatsen?`)
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

}