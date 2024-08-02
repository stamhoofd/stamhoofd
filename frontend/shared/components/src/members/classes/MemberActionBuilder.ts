import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding'
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation'
import { EmailRecipientFilterType, EmailRecipientSubfilter, Group, GroupCategoryTree, GroupType, MemberWithRegistrationsBlob, Organization, PermissionLevel, PlatformMember, RegisterCart, RegisterItem, Registration, mergeFilters } from '@stamhoofd/structures'
import { Formatter } from '@stamhoofd/utility'
import { markRaw } from 'vue'
import { checkoutDefaultItem, chooseOrganizationMembersForGroup, EditMemberAllBox, MemberSegmentedView, MemberStepView } from '..'
import EmailView from '../../email/EmailView.vue'
import { CenteredMessage, CenteredMessageButton } from '../../overlays/CenteredMessage'
import { Toast } from '../../overlays/Toast'
import { AsyncTableAction, InMemoryTableAction, MenuTableAction, TableAction, TableActionSelection } from '../../tables/classes'
import { NavigationActions } from '../../types/NavigationActions'
import EditMemberResponsibilitiesBox from '../components/edit/EditMemberResponsibilitiesBox.vue'
import { PlatformFamilyManager } from '../PlatformFamilyManager'
import { SessionContext } from '@stamhoofd/networking'

export class MemberActionBuilder {
    present: ReturnType<typeof usePresent>
    groups: Group[]
    organizations: Organization[]
    context: SessionContext
    platformFamilyManager: PlatformFamilyManager

    constructor(settings: {
        present: ReturnType<typeof usePresent>,
        context: SessionContext,
        groups: Group[],
        organizations: Organization[],
        platformFamilyManager: PlatformFamilyManager
    }) {
        this.present = settings.present
        this.context = settings.context
        this.groups = settings.groups
        this.organizations = settings.organizations
        this.platformFamilyManager = settings.platformFamilyManager
    }

    get inWaitingList() {
        return this.groups.length === 1 && this.groups.find(g => g.type === GroupType.WaitingList)
    }

    get hasWrite() {
        for (const group of this.groups) {
            if (!this.context.auth.canAccessGroup(group, PermissionLevel.Write)) {
                return false
            }
        }
        return true
    }

    getRegisterActions(organization?: Organization): TableAction<PlatformMember>[] {
        if (!organization) {
            if (this.organizations.length === 1) {
                return this.getRegisterActions(this.organizations[0])
            }
            return this.organizations.map(org => {
                return new MenuTableAction({
                    name: "Inschrijven bij " + org.name,
                    groupIndex: 0,
                    childActions: () => this.getRegisterActions(org)
                })
            })
        }

        return [
            new MenuTableAction({
                name: "Wachtlijsten",
                groupIndex: 0,
                enabled: organization.period.waitingLists.length > 0,
                childActions: () => [
                    ...organization.period.waitingLists.map(g => {
                        return new InMemoryTableAction({
                            name: g.settings.name,
                            needsSelection: true,
                            allowAutoSelectAll: false,
                            handler: async (members: PlatformMember[]) => {
                                await this.register(members, g)
                            }
                        })
                    })
                ]
            }),
            ...this.getActionsForCategory(organization.period.adminCategoryTree, async (members, group) => await this.register(members, group))
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
            new MenuTableAction({
                name: "Verplaatsen naar",
                priority: 1,
                groupIndex: 5,
                needsSelection: true,
                allowAutoSelectAll: false,
                enabled: this.hasWrite,
                childActions: () => [
                    new MenuTableAction({
                        name: "Wachtlijsten",
                        groupIndex: 0,
                        enabled: organization.period.waitingLists.length > 0,
                        childActions: () => [
                            ...organization.period.waitingLists.map(g => {
                                return new InMemoryTableAction({
                                    name: g.settings.name,
                                    needsSelection: true,
                                    allowAutoSelectAll: false,
                                    handler: (members: PlatformMember[]) => {
                                        this.moveRegistrations(members, g)
                                    }
                                })
                            })
                        ]
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

        return [new InMemoryTableAction({
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

    getActionsForCategory(category: GroupCategoryTree, action: (members: PlatformMember[], group: Group) => void|Promise<void>): TableAction<PlatformMember>[] {
        return [
            ...category.categories.map(c => {
                return new MenuTableAction({
                    name: c.settings.name,
                    groupIndex: 2,
                    needsSelection: true,
                    allowAutoSelectAll: false,
                    enabled: c.groups.length > 0 || c.categories.length > 0,
                    childActions: () => this.getActionsForCategory(c, action),
                })
            }),
            ...category.groups.map(g => {
                return new InMemoryTableAction({
                    name: g.settings.name,
                    needsSelection: true,
                    allowAutoSelectAll: false,
                    handler: async (members: PlatformMember[]) => {
                        await action(members, g)
                    }
                })
            })
        ];
    }

    getActions(): TableAction<PlatformMember>[] {
        return [
            new InMemoryTableAction({
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

            new InMemoryTableAction({
                name: "Functies bewerken",
                icon: "star",
                priority: 0,
                groupIndex: 1,
                needsSelection: true,
                singleSelection: true,
                enabled: this.context.auth.hasFullAccess(),
                handler: (members: PlatformMember[]) => {
                    this.editResponsibilities(members[0])
                }
            }),
        
            new AsyncTableAction({
                name: "E-mailen",
                icon: "email",
                priority: 10,
                groupIndex: 3,
                handler: async (selection: TableActionSelection<PlatformMember>) => {
                    await this.openMail(selection)
                }
            }),
        
            new InMemoryTableAction({
                name: "SMS'en",
                icon: "feedback-line",
                priority: 9,
                groupIndex: 3,

                handler: (members: PlatformMember[]) => {
                    this.openSMS(members)
                }
            }),

            new MenuTableAction({
                name: "Exporteren naar",
                icon: "download",
                priority: 11,
                groupIndex: 3,
                childActions: [
                    new InMemoryTableAction({
                        name: "Excel...",
                        priority: 0,
                        groupIndex: 0,
                        handler: async (members: PlatformMember[]) => {
                        // TODO: vervangen door een context menu
                            await this.exportToExcel(members)
                        }
                    }),
                    new InMemoryTableAction({
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
            new MenuTableAction({
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

            new InMemoryTableAction({
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

            new InMemoryTableAction({
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
            /*new InMemoryTableAction({
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

            new InMemoryTableAction({
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
            }),*/


            new InMemoryTableAction({
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
    async openMail(selection: TableActionSelection<PlatformMember>) {
        const filter = mergeFilters([
            selection.fetcher.filter,
            selection.markedRows.size === 0 ? null : (
                selection.markedRowsAreSelected ? {
                    id: {
                        $in: [...selection.markedRows.values()].map(m => m.id)
                    }
                } : {
                    $not: {
                        id: {
                            $in: [...selection.markedRows.values()].map(m => m.id)
                        }
                    }
                }
            )
        ])
        const search = selection.fetcher.searchQuery

        const options: {
            name: string,
            value: EmailRecipientSubfilter[]
        }[][] = [];

        options.push([
            {
                name: "Alle leden",
                value: [
                    EmailRecipientSubfilter.create({
                        type: EmailRecipientFilterType.Members,
                        filter,
                        search
                    })
                ]
            },
            {
                name: "Geen leden",
                value: []
            },
            {
                name: "Alle volwassen leden",
                value: [
                    EmailRecipientSubfilter.create({
                        type: EmailRecipientFilterType.Members,
                        filter: mergeFilters([
                            filter,
                            {
                                age: {
                                    $gt: 17
                                }
                            }
                        ]),
                        search
                    })
                ]
            }
        ])

        options.push([
            {
                name: "Ouders van minderjarige leden",
                value: [
                    EmailRecipientSubfilter.create({
                        type: EmailRecipientFilterType.MemberParents,
                        filter: mergeFilters([
                            filter,
                            {
                                age: {
                                    $lt: 18
                                }
                            }
                        ]),
                        search
                    })
                ]
            },
            {
                name: "Alle ouders",
                value: [
                    EmailRecipientSubfilter.create({
                        type: EmailRecipientFilterType.MemberParents,
                        filter,
                        search
                    })
                ]
            },
            {
                name: "Geen ouders",
                value: []
            }
        ])

        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(EmailView, {
                emails: this.organizations.flatMap(o => o.privateMeta?.emails),
                recipientFilterOptions: options,
                manageEmails: () => {
                    // todo
                }
            })
        });
        await this.present({
            components: [
                displayedComponent
            ],
            modalDisplayStyle: "popup"
        });
    }

    openSMS(members: PlatformMember[]) {
        Toast.info('Deze functie is tijdelijk niet beschikbaar').show()
        // const displayedComponent = new ComponentWithProperties(SMSView, {
        //     members,
        // });
        // this.present(displayedComponent.setDisplayStyle("popup"));
    }

    async showMember(member: PlatformMember) {
        const component = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MemberSegmentedView, {
                member
            }),
        });

        await this.present({
            components: [component],
            modalDisplayStyle: "popup"
        });
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

    moveRegistrations(members: PlatformMember[], group: Group) {
        const member = members.length == 1 ? members[0].patchedMember.name : members.length+" leden"
        new CenteredMessage(`${member} verplaatsen naar ${group.settings.name}?`)
            .addButton(new CenteredMessageButton("Ja, verplaats", {
                action: async () => {
                    //await MemberManager.moveRegistrations(members, this.groups, this.cycleOffset, this.inWaitingList, group)

                    const patches = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;
                    for (const member of members) {
                        const registrationsPatch = new PatchableArray() as PatchableArrayAutoEncoder<Registration>;
                        const registrations = member.filterRegistrations({groups: this.groups})

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

    async register(members: PlatformMember[], group: Group) {
        if (members.length === 1) {
            return await checkoutDefaultItem({
                member: members[0], 
                group,
                admin: true,
                groupOrganization: this.organizations.find(o => o.id === group.organizationId)!,
                context: this.context,
                navigate: {
                    present: this.present,
                    show: this.present,
                    pop: () => Promise.resolve(),
                    dismiss: () => Promise.resolve()
                },
                options: {
                    present: 'popup'
                },

                // Immediately checkout instead of only adding it to the cart
                startCheckoutFlow: true
            })
        }

        return await chooseOrganizationMembersForGroup({
            members, 
            group,
            groupOrganization: this.organizations.find(o => o.id === group.organizationId)!,
            context: this.context,
            navigate: {
                present: this.present,
                show: this.present,
                pop: () => Promise.resolve(),
                dismiss: () => Promise.resolve()
            }
        })

        /*new CenteredMessage(`${member} inschrijven voor ${group.settings.name}?`)
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
            .show()*/
    }
}
