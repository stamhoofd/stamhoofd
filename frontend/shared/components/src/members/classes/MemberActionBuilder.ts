import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation'
import { SessionContext, useRequestOwner } from '@stamhoofd/networking'
import { EmailRecipientFilterType, EmailRecipientSubfilter, Group, GroupCategoryTree, mergeFilters, Organization, PermissionLevel, PlatformMember, RegisterItem, RegistrationWithMember } from '@stamhoofd/structures'
import { markRaw } from 'vue'
import { checkoutDefaultItem, chooseOrganizationMembersForGroup, EditMemberAllBox, MemberSegmentedView, MemberStepView } from '..'
import EmailView from '../../email/EmailView.vue'
import { useContext, useOrganization } from '../../hooks'
import { Toast } from '../../overlays/Toast'
import { AsyncTableAction, InMemoryTableAction, MenuTableAction, TableAction, TableActionSelection } from '../../tables/classes'
import { NavigationActions } from '../../types/NavigationActions'
import EditMemberResponsibilitiesBox from '../components/edit/EditMemberResponsibilitiesBox.vue'
import { PlatformFamilyManager, usePlatformFamilyManager } from '../PlatformFamilyManager'

export function useDirectMemberActions(options?: {groups?: Group[], organizations?: Organization[]}) {
    return useMemberActions()(options)
}

export function useMemberActions() {
    const present = usePresent()
    const context = useContext()
    const platformFamilyManager = usePlatformFamilyManager()
    const owner = useRequestOwner()
    const organization = useOrganization()

    return (options?: {groups?: Group[], organizations?: Organization[]}) => {
        return new MemberActionBuilder({
            present,
            context: context.value,
            groups: options?.groups ?? [],
            organizations: organization.value ? [organization.value] : (options?.organizations ?? []),
            platformFamilyManager,
            owner
        })
    }
}

export class MemberActionBuilder {
    /**
     * Determines which registrations will get moved or removed
     */
    groups: Group[]

    /**
     * Determines what to move or register the members to
     */
    organizations: Organization[]
    
    present: ReturnType<typeof usePresent>
    context: SessionContext
    platformFamilyManager: PlatformFamilyManager
    owner: any

    constructor(settings: {
        present: ReturnType<typeof usePresent>,
        context: SessionContext,
        groups: Group[],
        organizations: Organization[],
        platformFamilyManager: PlatformFamilyManager
        owner: any
    }) {
        this.present = settings.present
        this.context = settings.context
        this.groups = settings.groups
        this.organizations = settings.organizations
        this.platformFamilyManager = settings.platformFamilyManager
        this.owner = settings.owner
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

            ...this.getMoveAction(),

            ...this.getUnsubscribeAction()
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

    async deleteRegistration(members: PlatformMember[]) {
        const deleteRegistrations = members.flatMap(m => m.filterRegistrations({groups: this.groups}).map(r => RegistrationWithMember.from(r, m.patchedMember.tiny)))
        return await chooseOrganizationMembersForGroup({
            members, 
            group: this.groups[0],
            context: this.context,
            owner: this.owner,
            deleteRegistrations,
            items: [],
            navigate: {
                present: this.present,
                show: this.present,
                pop: () => Promise.resolve(),
                dismiss: () => Promise.resolve()
            }
        })
    }

    get groupIds() {
        return this.groups?.map(g => g.id) ?? []
    }

    async moveRegistrations(members: PlatformMember[], group: Group) {
        const items: RegisterItem[] = [];

        // TODO:
        const groupOrganization = this.organizations.find(o => o.id === group.organizationId)!

        for (const member of members) {
            const item = RegisterItem.defaultFor(member, group, groupOrganization);
            item.replaceRegistrations = member.filterRegistrations({groups: this.groups}).map(r => RegistrationWithMember.from(r, member.patchedMember.tiny))
            items.push(item);
        }


        return await chooseOrganizationMembersForGroup({
            members, 
            group,
            context: this.context,
            owner: this.owner,
            items,
            navigate: {
                present: this.present,
                show: this.present,
                pop: () => Promise.resolve(),
                dismiss: () => Promise.resolve()
            }
        })
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
                displayOptions: {
                    action: 'present',
                    modalDisplayStyle: 'popup'
                },

                // Immediately checkout instead of only adding it to the cart
                startCheckoutFlow: true
            })
        }

        return await chooseOrganizationMembersForGroup({
            members, 
            group,
            context: this.context,
            owner: this.owner,
            navigate: {
                present: this.present,
                show: this.present,
                pop: () => Promise.resolve(),
                dismiss: () => Promise.resolve()
            }
        })
    }
}
