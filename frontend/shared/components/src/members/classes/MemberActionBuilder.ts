import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding'
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation'
import { Group, GroupCategoryTree, MemberWithRegistrationsBlob, Organization, PlatformMember, RegisterCart, RegisterItem, Registration } from '@stamhoofd/structures'
import { Formatter } from '@stamhoofd/utility'
import { CenteredMessage, CenteredMessageButton } from '../../overlays/CenteredMessage'
import { Toast } from '../../overlays/Toast'
import { TableAction } from '../../tables/TableAction'
import { PlatformFamilyManager } from '../PlatformFamilyManager'
import { EditMemberAllBox, MemberStepView } from '..'
import { markRaw } from 'vue'
import { NavigationActions } from '../../types/NavigationActions'
import EditMemberResponsibilitiesBox from '../components/edit/EditMemberResponsibilitiesBox.vue';

export class MemberActionBuilder {
    present: ReturnType<typeof usePresent>
    groups: Group[]
    organizations: Organization[]
    hasWrite: boolean
    inWaitingList = false
    platformFamilyManager: PlatformFamilyManager

    constructor(settings: {
        present: ReturnType<typeof usePresent>,
        hasWrite: boolean,
        groups: Group[],
        inWaitingList?: boolean,
        organizations: Organization[],
        platformFamilyManager: PlatformFamilyManager
    }) {
        this.present = settings.present
        this.hasWrite = settings.hasWrite
        this.groups = settings.groups
        this.inWaitingList = settings.inWaitingList ?? false
        this.organizations = settings.organizations
        this.platformFamilyManager = settings.platformFamilyManager
    }

    getRegisterActions(organization?: Organization): TableAction<PlatformMember>[] {
        if (!organization) {
            if (this.organizations.length === 1) {
                return this.getRegisterActions(this.organizations[0])
            }
            return this.organizations.map(org => {
                return new TableAction({
                    name: "Inschrijven bij " + org.name,
                    groupIndex: 0,
                    childActions: () => this.getRegisterActions(org)
                })
            })
        }

        return [
            new TableAction({
                name: "Wachtlijst van",
                groupIndex: 0,
                childActions: () => [
                    ...this.getActionsForCategory(organization.adminCategoryTree, (members, group) => this.register(members, group, true))
                ]
            }),
            ...this.getActionsForCategory(organization.adminCategoryTree, (members, group) => this.register(members, group, false))
        ]
    }

    getMoveAction(): TableAction<PlatformMember>[] {
        if (this.organizations.length !== 1) {
            return []
        }

        if (this.groups.length === 0) {
            return []
        }

        const organization = this.organizations[0]
        return [
            new TableAction({
                name: this.inWaitingList ? "Verplaats naar wachtlijst" : "Verplaatsen naar",
                priority: 1,
                groupIndex: 5,
                needsSelection: true,
                allowAutoSelectAll: false,
                enabled: this.hasWrite,
                childActions: () => [
                    new TableAction({
                        name: "Wachtlijst",
                        groupIndex: 0,
                        enabled: !this.inWaitingList,
                        handler: (members) => {
                            this.moveToWaitingList(members)
                        }
                    }),
                    ...this.getActionsForCategory(organization.adminCategoryTree, (members, group) => this.moveRegistrations(members, group))
                ]
            })
        ]
    }

    getUnsubscribeAction(): TableAction<PlatformMember>[] {
        if (this.groups.length === 0) {
            return []
        }

        return [new TableAction({
            name: "Uitschrijven",
            priority: 0,
            groupIndex: 7,
            needsSelection: true,
            allowAutoSelectAll: false,
            enabled: this.hasWrite,
            handler: (members) => {
                this.deleteRegistration(members)
            }
        })];
    }

    getActionsForCategory(category: GroupCategoryTree, action: (members: PlatformMember[], group: Group) => void): TableAction<PlatformMember>[] {
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
                    handler: (members: PlatformMember[]) => {
                        action(members, g)
                    }
                })
            })
        ];
    }

    getActions(): TableAction<PlatformMember>[] {
        return [
            new TableAction({
                name: "Bewerk",
                icon: "edit",
                priority: 0,
                groupIndex: 1,
                needsSelection: true,
                singleSelection: true,
                enabled: this.hasWrite,
                handler: (members: PlatformMember[]) => {
                    this.editMember(members[0])
                }
            }),

            new TableAction({
                name: "Functies bewerken",
                icon: "star",
                priority: 0,
                groupIndex: 1,
                needsSelection: true,
                singleSelection: true,
                enabled: this.hasWrite,
                handler: (members: PlatformMember[]) => {
                    this.editResponsibilities(members[0])
                }
            }),
        
            new TableAction({
                name: "E-mailen",
                icon: "email",
                priority: 10,
                groupIndex: 3,
                handler: (members: PlatformMember[]) => {
                    this.openMail(members)
                }
            }),
        
            new TableAction({
                name: "SMS'en",
                icon: "feedback-line",
                priority: 9,
                groupIndex: 3,

                handler: (members: PlatformMember[]) => {
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
                        handler: async (members: PlatformMember[]) => {
                        // TODO: vervangen door een context menu
                            await this.exportToExcel(members)
                        }
                    }),
                    new TableAction({
                        name: "PDF...",
                        priority: 0,
                        groupIndex: 0,
                        handler: async (members: PlatformMember[]) => {
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
            ...this.getMoveAction(),

            ...this.getUnsubscribeAction(),

            ...this.getWaitingListActions(),

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
    getWaitingListActions(): TableAction<PlatformMember>[] {
        return [
            //
            new TableAction({
                name: "Toelaten om in te schrijven",
                icon: "success",
                priority: 15,
                groupIndex: 6,
                enabled: this.hasWrite && this.inWaitingList,
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (members: PlatformMember[]) => {
                    await this.setCanRegister(members, true)
                }
            }),

            new TableAction({
                name: "Toelating intrekken",
                icon: "canceled",
                priority: 14,
                groupIndex: 6,
                enabled: this.hasWrite && this.inWaitingList,
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (members: PlatformMember[]) => {
                    await this.setCanRegister(members, false)
                }
            }),


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

    // Action implementations
    openMail(members: PlatformMember[], subject = "") {
        Toast.info('Deze functie is tijdelijk niet beschikbaar').show()
        //const displayedComponent = new ComponentWithProperties(NavigationController, {
        //    root: new ComponentWithProperties(MailView, {
        //        members,
        //        group: this.groups.length === 1 ? this.groups[0] : undefined,
        //        defaultSubject: subject,
        //        defaultReplacements: OrganizationManager.organization.meta.getEmailReplacements()
        //    })
        //});
        //this.present(displayedComponent.setDisplayStyle("popup"));
    }

    openSMS(members: PlatformMember[]) {
        Toast.info('Deze functie is tijdelijk niet beschikbaar').show()
        // const displayedComponent = new ComponentWithProperties(SMSView, {
        //     members,
        // });
        // this.present(displayedComponent.setDisplayStyle("popup"));
    }

    editMember(member: PlatformMember) {
        this.present({
            components: [
                new ComponentWithProperties(MemberStepView, {
                    member,
                    title: member.member.firstName + ' bewerken',
                    component: markRaw(EditMemberAllBox),
                    saveHandler: async ({dismiss}: NavigationActions) => {
                        await dismiss({force: true});
                    }
                })
            ],
            modalDisplayStyle: "popup"
        }).catch(console.error)
    }

    editResponsibilities(member: PlatformMember) {
        this.present({
            components: [
                new ComponentWithProperties(MemberStepView, {
                    member,
                    title: 'Functies van ' + member.member.firstName,
                    component: markRaw(EditMemberResponsibilitiesBox),
                    saveHandler: async ({dismiss}: NavigationActions) => {
                        await dismiss({force: true});
                    }
                })
            ],
            modalDisplayStyle: "popup"
        }).catch(console.error)
    }

    async exportToExcel(members: PlatformMember[]) {
        Toast.info('Deze functie is tijdelijk niet beschikbaar').show()
        //const displayedComponent = new ComponentWithProperties(NavigationController, {
        //    root: await LoadComponent(() => import(/* webpackChunkName: "MemberExcelBuilderView"*/ '../member/MemberExcelBuilderView.vue'), {
        //        members,
        //        groups: this.groups,
        //        waitingList: this.inWaitingList,
        //        cycleOffset: this.cycleOffset
        //    })
        //});
        //this.present(displayedComponent.setDisplayStyle("popup"));
    }

    async exportToPDF(members: PlatformMember[]) {
        Toast.info('Deze functie is tijdelijk niet beschikbaar').show()
        //const displayedComponent = new ComponentWithProperties(NavigationController, {
        //    root: await LoadComponent(() => import(/* webpackChunkName: "MemberSummaryBuilderView"*/ '../member/MemberSummaryBuilderView.vue'), {
        //        members,
        //        group: this.groups.length === 1 ? this.groups[0] : undefined,
        //    })
        //});
        //this.present(displayedComponent.setDisplayStyle("popup"));
    }

    deleteRecords(members: PlatformMember[]) {
        Toast.info('Deze functie is tijdelijk niet beschikbaar').show()
        //const member = members.length == 1 ? members[0].name : members.length+" leden"
        //new CenteredMessage(`Gegevens van ${member} wissen`, "Opgelet, je kan dit niet ongedaan maken! Deze functie houdt de leden wel in het systeem, maar verwijdert een deel van de gegevens (o.a. handig om in orde te zijn met GDPR).")
        //    .addButton(new CenteredMessageButton("Behoud contactgegevens", {
        //        action: async () => {
        //            if (await CenteredMessage.confirm("Ben je zeker?", "Verwijder", "Alle gegevens van deze leden, met uitzondering van hun voor- en achternaam, e-mailadres en telefoonnummer (van leden zelf en ouders indien -18jaar) worden verwijderd.")) {
        //                await MemberManager.deleteDataExceptContacts(members)
        //                new Toast(`De gegevens van ${member} zijn verwijderd.`, "success green").show()
        //            }
        //        },
        //        type: "destructive",
        //        icon: "trash"
        //    }))
        //    .addButton(new CenteredMessageButton("Behoud enkel naam", {
        //        action: async () => {
        //            if (await CenteredMessage.confirm("Ben je zeker?", "Verwijder", "Alle gegevens van deze leden, met uitzondering van hun voor- en achternaam worden verwijderd.")) {
        //                await MemberManager.deleteData(members)
        //                new Toast(`De gegevens van ${member} zijn verwijderd.`, "success green").show()
        //            }
        //        },
        //        type: "destructive",
        //        icon: "trash"
        //    }))
        //    .addCloseButton("Annuleren")
        //    .show()
    }

    deleteData(members: PlatformMember[]) {
        Toast.info('Deze functie is tijdelijk niet beschikbaar').show()

        //const member = members.length == 1 ? members[0].name : members.length+" leden"
        //new CenteredMessage(`${member} definitief verwijderen?`, "Je kan dit niet ongedaan maken. Je verliest alle gegevens, betaalgegevens, accounts...")
        //    .addButton(new CenteredMessageButton("Verwijderen", {
        //        action: () => {
        //            CenteredMessage.confirm("Begrijp je dat dit alles verwijdert?", "Ja, verwijderen", 'Alle inschrijvingen, betaalgegevens, gegevens en accounts gaan verloren.').then(async (confirmed) => {
        //                if (confirmed) {
        //                    await MemberManager.deleteMembers(members)
        //                    new Toast(`${member} ${members.length > 1 ? 'zijn' : 'is'} verwijderd`, "success green").show()
        //                }
        //            }).catch(console.error)
        //            return Promise.resolve()
        //        },
        //        type: "destructive",
        //        icon: "trash"
        //    }))
        //    .addCloseButton("Annuleren")
        //    .show()
    }

    deleteRegistration(members: PlatformMember[]) {
        const member = members.length == 1 ? members[0].patchedMember.name : members.length+" leden"
        new CenteredMessage(`${member} uitschrijven?`, `Hiermee verwijder je alleen de inschrijvingen bij ${Formatter.joinLast(this.groups.map(g => g.settings.name), ', ', ' of ')}. Andere inschrijvingen en gegevens van ${member} blijven behouden.`)
            .addButton(new CenteredMessageButton("Uitschrijven", {
                action: () => {
                    (async () => {
                        if (members.length == 1 || await CenteredMessage.confirm("Ben je echt heel zeker?", "Ja, uitschrijven")) {
                            await this.platformFamilyManager.unregisterMembers(
                                members.map(m => {
                                    const registrations = m.filterRegistrations({groups: this.groups, waitingList: this.inWaitingList})

                                    return {
                                        member: m,
                                        removeRegistrations: registrations
                                    }
                                }), 
                                {
                                    shouldRetry: false
                                }
                            )
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
  
    async setCanRegister(members: PlatformMember[], allow = true) {
        members = members.filter(m => {
            const regs = m.filterRegistrations({groups: this.groups, waitingList: true, canRegister: !allow})
            return regs.length > 0
        })
        if (members.length == 0) {
            return;
        }

        try {
            const patches = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;
            for (const member of members) {
                const registrationsPatch = new PatchableArray() as PatchableArrayAutoEncoder<Registration>;

                const registrations = member.filterRegistrations({groups: this.groups, waitingList: true, canRegister: !allow})

                for (const registration of registrations) {
                    registrationsPatch.addPatch(Registration.patch({
                        id: registration.id,
                        canRegister: allow
                    }))
                }

                patches.addPatch(MemberWithRegistrationsBlob.patch({
                    id: member.id,
                    registrations: registrationsPatch
                }))
            }
            await this.platformFamilyManager.isolatedPatch(members, patches, false)
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

    acceptWaitingList(members: PlatformMember[]) {
        const member = members.length == 1 ? members[0].patchedMember.name : members.length+" leden"
        new CenteredMessage(`${member} inschrijven?`, "We raden sterk aan om leden toe te laten en daarna uit te nodigen om in te schrijven via een e-mail. Dan zijn ze verplicht om de rest van hun gegevens aan te vullen en de betaling in orde te brengen.")
            .addButton(new CenteredMessageButton("Ja, inschrijven", {
                action: async () => {
                    const patches = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;
                    for (const member of members) {
                        const registrationsPatch = new PatchableArray() as PatchableArrayAutoEncoder<Registration>;
                        const registrations = member.filterRegistrations({groups: this.groups, waitingList: true})

                        if (registrations.length === 0) {
                            continue
                        }
        
                        for (const registration of registrations) {
                            const cart = new RegisterCart()
                            cart.add(new RegisterItem({
                                member: member,
                                group: registration.group,
                                waitingList: false
                            }))
                            cart.calculatePrices()
                            const price = cart.price
                            registrationsPatch.addPatch(
                                Registration.patch({
                                    id: registration.id,
                                    waitingList: false,
                                    price
                                })
                            )
                        }
        
                        patches.addPatch(MemberWithRegistrationsBlob.patch({
                            id: member.id,
                            registrations: registrationsPatch
                        }))
                    }
                    await this.platformFamilyManager.isolatedPatch(members, patches, false)
                    new Toast(members.length+" leden zijn ingeschreven", "success green").show()
                },
                type: "destructive",
                icon: "download"
            }))
            .addCloseButton("Annuleren")
            .show()
    }

    moveToWaitingList(members: PlatformMember[]) {
        const member = members.length == 1 ? members[0].patchedMember.name : members.length+" leden"
        new CenteredMessage(`${member} naar de wachtlijst verplaatsen?`)
            .addButton(new CenteredMessageButton("Ja, verplaats", {
                action: async () => {
                    const patches = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;
                    for (const member of members) {
                        const registrationsPatch = new PatchableArray() as PatchableArrayAutoEncoder<Registration>;
                        const registrations = member.filterRegistrations({groups: this.groups, waitingList: false})

                        if (registrations.length === 0) {
                            continue
                        }
        
                        for (const registration of registrations) {
                            registrationsPatch.addPatch(
                                Registration.patch({
                                    id: registration.id,
                                    waitingList: true
                                })
                            )
                        }
        
                        patches.addPatch(MemberWithRegistrationsBlob.patch({
                            id: member.id,
                            registrations: registrationsPatch
                        }))
                    }
                    await this.platformFamilyManager.isolatedPatch(members, patches, false)
                    new Toast(members.length+" leden zijn naar de wachtlijst verplaatst", "success green").show()
                },
                icon: "clock"
            }))
            .addCloseButton("Annuleren")
            .show()
    }

    moveRegistrations(members: PlatformMember[], group: Group) {
        const member = members.length == 1 ? members[0].patchedMember.name : members.length+" leden"
        new CenteredMessage(`${member} verplaatsen naar ${group.settings.name}?`)
            .addButton(new CenteredMessageButton("Ja, verplaats", {
                action: async () => {
                    //await MemberManager.moveRegistrations(members, this.groups, this.cycleOffset, this.inWaitingList, group)

                    const patches = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;
                    for (const member of members) {
                        const registrationsPatch = new PatchableArray() as PatchableArrayAutoEncoder<Registration>;
                        const registrations = member.filterRegistrations({groups: this.groups, waitingList: this.inWaitingList})

                        if (registrations.length === 0) {
                            continue
                        }
        
                        for (const registration of registrations) {
                            // Check if already has a registratino with these details, skip otherwise
                            if (member.patchedMember.registrations.find(r => r.id !== registration.id && r.groupId === group.id)) {
                                throw new Error('Je kan deze inschrijving niet verplaatsen omdat ' + member.patchedMember.name + ' al is ingeschreven bij die groep of daarbij horende wachtlijst in die periode')
                            }

                            registrationsPatch.addPatch(
                                Registration.patch({
                                    id: registration.id,
                                    group
                                })
                            )
                        }
        
                        patches.addPatch(MemberWithRegistrationsBlob.patch({
                            id: member.id,
                            registrations: registrationsPatch
                        }))
                    }

                    console.log('patching', patches)
                    await this.platformFamilyManager.isolatedPatch(members, patches, false)
                    new Toast(members.length+` leden zijn naar ${group.settings.name} verplaatst`, "success green").show()
                },
                icon: "sync"
            }))
            .addCloseButton("Annuleren")
            .show()
    }

    register(members: PlatformMember[], group: Group, waitingList: boolean) {
        const member = members.length == 1 ? members[0].patchedMember.name : members.length+" leden"

        new CenteredMessage(waitingList ? `${member} op wachtlijst plaatsen van ${group.settings.name}?` : `${member} inschrijven voor ${group.settings.name}?`)
            .addButton(new CenteredMessageButton("Ja, inschrijven", {
                action: async () => {
                    const n = members.length == 1 ? members[0].patchedMember.name + ' is' : members.length+" leden zijn"

                    const patches = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;
                    for (const member of members) {
                        const registrationsPatch = new PatchableArray() as PatchableArrayAutoEncoder<Registration>;
                        
                        if (!waitingList) {
                            const waitingListRegistrations = member.filterRegistrations({groups: [group], waitingList: true})

                            // Move from waiting list to registration
                            for (const registration of waitingListRegistrations) {
                                const cart = new RegisterCart()
                                cart.add(new RegisterItem({
                                    member: member,
                                    group: registration.group,
                                    waitingList
                                }))
                                cart.calculatePrices()
                                const price = cart.price
                                registrationsPatch.addPatch(
                                    Registration.patch({
                                        id: registration.id,
                                        waitingList,
                                        price
                                    })
                                )
                                patches.addPatch(MemberWithRegistrationsBlob.patch({
                                    id: member.id,
                                    registrations: registrationsPatch
                                }))
                            }

                            if (waitingListRegistrations.length) {
                                continue;
                            }
                        }

                        // Check duplicates
                        const registrations = member.filterRegistrations({groups: [group]})

                        if (registrations.length) {
                            throw new Error('Je kan ' + member.patchedMember.name + ' niet inschrijven voor '+ group.settings.name +' omdat die al is ingeschreven.')
                        }
        
        
                        // Insert new registration
                        const cart = new RegisterCart()
                        cart.add(new RegisterItem({
                            member: member,
                            group,
                            waitingList
                        }))
                        cart.calculatePrices()
                        const price = cart.price
                        const reg = Registration.create({
                            group,
                            waitingList,
                            registeredAt: new Date(),
                            organizationId: group.organizationId,
                            price
                        })
                        registrationsPatch.addPut(reg)

                        patches.addPatch(MemberWithRegistrationsBlob.patch({
                            id: member.id,
                            registrations: registrationsPatch
                        }))
                    }
                    await this.platformFamilyManager.isolatedPatch(members, patches, false)
                    new Toast(waitingList ? n+` op de wachtlijst geplaatst voor ${group.settings.name}` : n + ` ingeschreven voor ${group.settings.name}`, "success green").show()
                }
            }))
            .addCloseButton("Annuleren")
            .show()
    }
}
