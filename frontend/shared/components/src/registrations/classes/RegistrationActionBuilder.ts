import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { ExcelExportView } from '@stamhoofd/frontend-excel-export';
import type { SessionContext } from '@stamhoofd/networking/SessionContext';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import type { Group, GroupCategoryTree, Organization, OrganizationRegistrationPeriod, Platform, PlatformMember, PlatformRegistration } from '@stamhoofd/structures';
import { EmailRecipientFilterType, EmailRecipientSubfilter, ExcelExportType, GroupType, mergeFilters, PermissionLevel, PermissionsResourceType, RegistrationWithPlatformMember } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { AuditLogsView } from '../../audit-logs';
import { CommunicationView } from '../../communication';
import { LoadComponent } from '../../containers/AsyncComponent';
import type { RecipientChooseOneOption } from '../../email';
import { EmailView } from '../../email';
import { useContext, useOrganization, usePlatform } from '../../hooks';
import type { PlatformFamilyManager } from '../../members';
import { checkoutDefaultItem, chooseOrganizationMembersForGroup, deleteInvitationsForMembers, getActionsForCategory, getCategoryTreeOfGroupsLinkedToWaitingList, inviteMembersForGroup, isMemberInvited, presentDeleteMembers, presentEditMember, presentEditResponsibilities, presentExportMembersToPdf, usePlatformFamilyManager } from '../../members';
import { RegistrationsActionBuilder } from '../../members/classes/RegistrationsActionBuilder';
import { Toast } from '../../overlays/Toast';
import type { TableAction, TableActionSelection } from '../../tables';
import { AsyncTableAction, InMemoryTableAction, MenuTableAction } from '../../tables';
import ChargeRegistrationsView from '../ChargeRegistrationsView.vue';
import { getSelectableWorkbook } from './getSelectableWorkbook';

export function useDirectRegistrationActions(options?: { groups?: Group[];
    organizations?: Organization[];
}) {
    return useRegistrationActions()(options);
}

export function useRegistrationActions() {
    const present = usePresent();
    const context = useContext();
    const platformFamilyManager = usePlatformFamilyManager();
    const owner = useRequestOwner();
    const organization = useOrganization();
    const platform = usePlatform();

    return (options?: { groups?: Group[];
        organizations?: Organization[];
        forceWriteAccess?: boolean | null; }) => {
        return new RegistrationActionBuilder({
            present,
            platform: platform.value,
            context: context.value,
            groups: options?.groups ?? [],
            organizations: organization.value ? [organization.value] : (options?.organizations ?? []),
            platformFamilyManager,
            forceWriteAccess: options?.forceWriteAccess,
            owner,
        });
    };
}

export class RegistrationActionBuilder {
    private groups: Group[];
    private platform: Platform;
    private organizations: Organization[];
    private context: SessionContext;
    private platformFamilyManager: PlatformFamilyManager;
    private forceWriteAccess: boolean | null = null;
    private present: ReturnType<typeof usePresent>;
    private owner: any;

    get hasWrite() {
        if (this.forceWriteAccess !== null) {
            return this.forceWriteAccess;
        }

        for (const group of this.groups) {
            if (!this.context.auth.canAccessGroup(group, PermissionLevel.Write)) {
                return false;
            }
        }

        return true;
    }

    constructor(settings: {
        present: ReturnType<typeof usePresent>;
        context: SessionContext;
        groups: Group[];
        platform: Platform;
        organizations: Organization[];
        platformFamilyManager: PlatformFamilyManager;
        forceWriteAccess?: boolean | null;
        owner: any;
    }) {
        this.present = settings.present;
        this.context = settings.context;
        this.groups = settings.groups;
        this.organizations = settings.organizations;
        this.platformFamilyManager = settings.platformFamilyManager;
        this.owner = settings.owner;
        this.forceWriteAccess = settings.forceWriteAccess ?? null;
        this.platform = settings.platform;
    }

    getActions(options: { includeMove?: boolean; includeEdit?: boolean; selectedOrganizationRegistrationPeriod?: OrganizationRegistrationPeriod } = {}) {
        const actions: TableAction<PlatformRegistration>[] = [
            ...this.getMemberActions(),
            this.getEmailAction(),
            this.getSmsAction(),
            this.getExportAction(),
            (options.includeMove ? this.getMoveAction(options.selectedOrganizationRegistrationPeriod) : null),
            (options.includeEdit ? this.getEditAction() : null),
            this.getUnsubscribeAction(),
            ...this.getAuditLogAction(),
            ...this.getMessagesAction(),
        ].filter(a => a !== null);

        return actions;
    }

    private getMemberActions() {
        const actions: TableAction<PlatformRegistration>[] = [
            new InMemoryTableAction({
                name: $t(`%XO`),
                icon: 'edit',
                priority: 2,
                groupIndex: 1,
                needsSelection: true,
                singleSelection: true,
                enabled: this.hasWrite,
                handler: (registrations: PlatformRegistration[]) => {
                    if (registrations.length) {
                        presentEditMember({ member: registrations[0].member, present: this.present, context: this.context }).catch(console.error);
                    }
                },
            }),

            new InMemoryTableAction({
                name: $t(`%ej`),
                icon: 'star',
                priority: 0,
                groupIndex: 1,
                needsSelection: true,
                singleSelection: true,
                enabled: this.context.auth.hasFullAccess(),
                handler: (registrations: PlatformRegistration[]) => {
                    if (registrations.length) {
                        presentEditResponsibilities({ member: registrations[0].member, present: this.present }).catch(console.error);
                    }
                },
            }),

            new MenuTableAction<PlatformRegistration>({
                name: $t(`%dh`),
                priority: 1,
                groupIndex: 5,
                needsSelection: true,
                allowAutoSelectAll: false,
                enabled: this.hasWrite && !!this.context.organization,
                childActions: () => this.getRegisterActions(),
            }),
            this.getDeleteMemberAction(),
        ].filter(a => a !== null);

        return actions;
    }

    private getRegisterActions(organization?: Organization): TableAction<PlatformRegistration>[] {
        if (!organization) {
            if (this.organizations.length === 1) {
                return this.getRegisterActions(this.organizations[0]);
            }
            return this.organizations.map((org) => {
                return new MenuTableAction({
                    name: $t(`%eg`) + ' ' + org.name,
                    groupIndex: 0,
                    childActions: () => this.getRegisterActions(org),
                });
            });
        }

        return [
            new MenuTableAction({
                name: $t(`%eh`),
                groupIndex: 0,
                enabled: organization.period.waitingLists.length > 0,
                childActions: () => [
                    ...organization.period.waitingLists.map((g) => {
                        return new InMemoryTableAction({
                            name: g.settings.name.toString(),
                            needsSelection: true,
                            allowAutoSelectAll: false,
                            handler: async (registrations: PlatformRegistration[]) => {
                                const members = getUniqueMembersFromRegistrations(registrations);
                                await this.register(members, g);
                            },
                        });
                    }),
                ],
            }),
            ...getActionsForCategory<PlatformRegistration>(organization.period.adminCategoryTree, async (registrations, group) => await this.register(getUniqueMembersFromRegistrations(registrations), group)).map((r) => {
                r.description = organization.period.period.name;
                return r;
            }),
        ];
    }

    private async register(members: PlatformMember[], group: Group) {
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
                    dismiss: () => Promise.resolve(),
                },
                displayOptions: {
                    action: 'present',
                    modalDisplayStyle: 'popup',
                },

                // Immediately checkout instead of only adding it to the cart
                startCheckoutFlow: true,
            });
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
                dismiss: () => Promise.resolve(),
            },
        });
    }

    private getUnsubscribeAction(): InMemoryTableAction<PlatformRegistration> | null {
        return new InMemoryTableAction({
            name: $t(`%zu`),
            destructive: true,
            priority: 0,
            groupIndex: 7,
            needsSelection: true,
            allowAutoSelectAll: false,
            enabled: this.hasWrite,
            handler: async (registrations: PlatformRegistration[]) => {
                await this.deleteRegistrations(registrations);
            },
        });
    }

    getChargeAction() {
        return new AsyncTableAction({
            name: $t(`%Gu`),
            icon: 'calculator',
            priority: 13,
            groupIndex: 4,
            handler: async (selection: TableActionSelection<PlatformRegistration>) => {
                await this.present({
                    modalDisplayStyle: 'popup',
                    components: [
                        new ComponentWithProperties(ChargeRegistrationsView, {
                            filter: selection.filter.filter,
                        }),
                    ],
                });
            },
        });
    }

    getAuditLogAction(): TableAction<PlatformRegistration>[] {
        if ((this.organizations.length !== 1 || this.organizations[0].id !== this.context.organization?.id) && !this.context.auth.hasPlatformFullAccess()) {
            return [];
        }

        if (this.organizations.length === 1 && this.organizations[0].id === this.context.organization?.id && !this.context.auth.hasFullAccess()) {
            return [];
        }

        return [
            new InMemoryTableAction({
                name: $t(`%1KS`),
                priority: 1,
                groupIndex: 6,
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (registations: PlatformRegistration[]) => {
                    const members = getUniqueMembersFromRegistrations(registations);
                    if (members.length > 100) {
                        Toast.error($t(`%ei`)).show();
                        return;
                    }
                    await this.present({
                        components: [
                            new ComponentWithProperties(AuditLogsView, {
                                objectIds: members.map(m => m.id),
                            }),
                        ],
                        modalDisplayStyle: 'popup',
                    });
                },
                icon: 'history',
            }),
        ];
    }

    getMessagesAction(): TableAction<PlatformRegistration>[] {
        if (!this.context.auth.hasAccessForSomeResourceOfType(PermissionsResourceType.Senders, PermissionLevel.Read)) {
            return [];
        }

        return [
            new InMemoryTableAction({
                name: $t(`%1GU`),
                priority: 1,
                groupIndex: 6,
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (registations: PlatformRegistration[]) => {
                    const members = getUniqueMembersFromRegistrations(registations);
                    if (members.length > 100) {
                        Toast.error($t(`%ei`)).show();
                        return;
                    }
                    await this.present({
                        components: [
                            new ComponentWithProperties(NavigationController, {
                                root: new ComponentWithProperties(CommunicationView, {
                                    members,
                                }),
                            }),
                        ],
                        modalDisplayStyle: 'popup',
                    });
                },
                icon: 'history',
            }),
        ];
    }

    private getDeleteMemberAction() {
        const enabled = STAMHOOFD.userMode === 'platform' ? (!this.context.organization && this.context.auth.hasPlatformFullAccess()) : this.context.auth.hasFullAccess();
        if (!enabled) {
            return null;
        }
        return new InMemoryTableAction({
            name: $t('%16r'),
            destructive: true,
            priority: 1,
            groupIndex: 100,
            needsSelection: true,
            singleSelection: true,
            allowAutoSelectAll: false,
            icon: 'trash',
            enabled,
            handler: async (registrations: PlatformRegistration[]) => {
                await presentDeleteMembers({
                    members: getUniqueMembersFromRegistrations(registrations),
                    present: this.present,
                    platformFamilyManager: this.platformFamilyManager,
                });
            },
        });
    }

    private getMoveAction(selectedOrganizationRegistrationPeriod?: OrganizationRegistrationPeriod): TableAction<PlatformRegistration> | null {
        if (this.organizations.length !== 1) {
            return null;
        }

        const organization = this.organizations[0];
        const period = selectedOrganizationRegistrationPeriod ?? organization.period;

        let suggestedGroups = this.groups.map(g => g.waitingList).filter(g => g !== null);

        for (const g of this.groups) {
            const add = [g.event?.group, g.parentGroup, g.event?.group?.waitingList];
            for (const a of add) {
                if (a) {
                    if (suggestedGroups.find(gg => gg.id === a.id)) {
                        continue; // Already suggested
                    }
                    suggestedGroups.push(a);
                }
            }
        }

        suggestedGroups = suggestedGroups.filter(g => this.groups.find(gg => gg.id === g.id) === undefined); // Remove groups that are already selected

        return new MenuTableAction({
            name: $t(`%HB`),
            priority: 1,
            groupIndex: 5,
            needsSelection: true,
            allowAutoSelectAll: false,
            enabled: this.hasWrite,
            childActions: () => [
                ...suggestedGroups.map((g) => {
                    return new InMemoryTableAction({
                        name: g.settings.name.toString(),
                        needsSelection: true,
                        groupIndex: 0,
                        allowAutoSelectAll: false,
                        handler: async (members: PlatformRegistration[]) => {
                            await this.moveRegistrations(members, g);
                        },
                    });
                }),
                new MenuTableAction({
                    name: $t(`%eh`),
                    groupIndex: 0,
                    enabled: organization.period.waitingLists.length > 0,
                    childActions: () => [
                        ...organization.period.waitingLists.map((g) => {
                            return new InMemoryTableAction({
                                name: g.settings.name.toString(),
                                needsSelection: true,
                                allowAutoSelectAll: false,
                                handler: async (registrations: PlatformRegistration[]) => {
                                    await this.moveRegistrations(registrations, g);
                                },
                            });
                        }),
                    ],
                }),
                ...getActionsForCategory<PlatformRegistration>(period.adminCategoryTree, (registrations, group) => this.moveRegistrations(registrations, group)).map((r) => {
                    r.description = period.period.name;
                    return r;
                }),
            ],
        });
    }

    private getEditAction(): TableAction<PlatformRegistration> | null {
        if (this.organizations.length !== 1 || this.groups.length === 0) {
            return null;
        }

        return new InMemoryTableAction({
            name: $t(`%zt`),
            priority: 1,
            groupIndex: 1,
            needsSelection: true,
            allowAutoSelectAll: false,
            enabled: this.hasWrite,
            handler: async (registrations: PlatformRegistration[]) => {
                await this.editRegistrations(registrations);
            },
            icon: 'edit',
        });
    }

    private getExportAction() {
        return new MenuTableAction({
            name: $t('%17e'),
            icon: 'download',
            priority: 8,
            groupIndex: 3,
            childActions: [
                this.getExportToExcelAction(),
                this.getExportToPdfAction(),
            ],
        });
    }

    private getExportToExcelAction() {
        return new AsyncTableAction({
            name: $t('%17U'),
            priority: 0,
            groupIndex: 0,
            handler: async (selection: TableActionSelection<PlatformRegistration>) => {
                await this.exportToExcel(selection);
            },
        });
    }

    private getExportToPdfAction() {
        return new InMemoryTableAction({
            name: $t('%17V'),
            priority: 0,
            groupIndex: 0,
            fetchLimitSettings: { limit: 500, createErrorMessage: (count, limit) => {
                return $t('%17W', { count: Formatter.float(count), limit: Formatter.float(limit) });
            } },
            handler: async (registrations: PlatformRegistration[]) => {
                await this.exportToPdf(registrations.map(r => r.member));
            },
        });
    }

    private getEmailAction() {
        return new AsyncTableAction({
            name: $t(`%1GW`),
            icon: 'email',
            priority: 12,
            groupIndex: 3,
            handler: async (selection: TableActionSelection<PlatformRegistration>) => {
                await this.openMail(selection);
            },
        });
    }

    private getSmsAction() {
        return new InMemoryTableAction({
            name: $t(`%PI`),
            icon: 'feedback-line',
            priority: 9,
            groupIndex: 3,
            fetchLimitSettings: { limit: 200, createErrorMessage: (count, limit) => {
                return $t('%16s', { count: Formatter.float(count), limit: Formatter.float(limit) });
            } },
            handler: async (registrations: PlatformRegistration[]) => {
                await this.openSms(registrations);
            },
        });
    }

    private async openSms(registrations: PlatformRegistration[]) {
        const displayedComponent = await LoadComponent(() => import(/* webpackChunkName: "SMSView" */ '#views/SMSView.vue'), {
            members: getUniqueMembersFromRegistrations(registrations).map(pm => pm.member),
        });
        this.present(displayedComponent.setDisplayStyle('popup')).catch(console.error);
    }

    async openMail(selection: TableActionSelection<PlatformRegistration>) {
        const filter = selection.filter.filter;
        const search = selection.filter.search;

        const options: RecipientChooseOneOption[] = [];

        options.push({
            type: 'ChooseOne',
            options: [
                {
                    id: 'all',
                    name: $t(`%L8`),
                    value: [
                        EmailRecipientSubfilter.create({
                            type: EmailRecipientFilterType.RegistrationMembers,
                            filter,
                            search,
                        }),
                    ],
                },
                {
                    id: 'none',
                    name: $t(`%el`),
                    value: [],
                },
                {
                    id: 'adults',
                    name: $t(`%em`),
                    value: [
                        EmailRecipientSubfilter.create({
                            type: EmailRecipientFilterType.RegistrationMembers,
                            filter: mergeFilters([
                                filter,
                                {
                                    member: {
                                        $elemMatch: {
                                            age: {
                                                $gt: 17,
                                            },
                                        },
                                    },
                                },
                            ]),
                            search,
                        }),
                    ],
                },
            ],
        });

        options.push({
            type: 'ChooseOne',
            options: [
                {
                    id: 'minors',
                    name: $t(`%en`),
                    value: [
                        EmailRecipientSubfilter.create({
                            type: EmailRecipientFilterType.RegistrationParents,
                            filter: mergeFilters([
                                filter,
                                {
                                    member: {
                                        $elemMatch: {
                                            age: {
                                                $lt: 18,
                                            },
                                        },
                                    },
                                },
                            ]),
                            search,
                        }),
                    ],
                },
                {
                    id: 'all',
                    name: $t(`%eo`),
                    value: [
                        EmailRecipientSubfilter.create({
                            type: EmailRecipientFilterType.RegistrationParents,
                            filter,
                            search,
                        }),
                    ],
                },
                {
                    id: 'none',
                    name: $t(`%ep`),
                    value: [],
                },
            ],
        });

        options.push({
            type: 'ChooseOne',
            options: [
                {
                    id: 'none',
                    name: $t(`%eq`),
                    value: [],
                },
                {
                    id: 'minors',
                    name: $t(`%er`),
                    value: [
                        EmailRecipientSubfilter.create({
                            type: EmailRecipientFilterType.RegistrationUnverified,
                            filter: mergeFilters([
                                filter,
                                {
                                    member: {
                                        $elemMatch: {
                                            age: {
                                                $lt: 18,
                                            },
                                        },
                                    },
                                },
                            ]),
                            search,
                        }),
                    ],
                },
                {
                    id: 'all',
                    name: $t(`%es`),
                    value: [
                        EmailRecipientSubfilter.create({
                            type: EmailRecipientFilterType.RegistrationUnverified,
                            filter,
                            search,
                        }),
                    ],
                },
            ],
        });

        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(EmailView, {
                recipientFilterOptions: options,
                defaultSenderId: this.groups.length === 1 ? this.groups[0].privateSettings?.defaultEmailId : null,
            }),
        });
        await this.present({
            components: [
                displayedComponent,
            ],
            modalDisplayStyle: 'popup',
        });
    }

    private async editRegistrations(registrations: PlatformRegistration[]) {
        return this.getRegistrationActionBuilder(registrations)?.editRegistrations();
    }

    private async moveRegistrations(registrations: PlatformRegistration[], group: Group) {
        return this.getRegistrationActionBuilder(registrations)?.moveRegistrations(group);
    }

    private getRegistrationActionBuilder(registrations: PlatformRegistration[]) {
        if (this.organizations.length !== 1) {
            return;
        }

        const groupOrganization = this.organizations[0];
        const members = getUniqueMembersFromRegistrations(registrations);

        return new RegistrationsActionBuilder({
            context: this.context,
            owner: this.owner,
            present: this.present,
            organization: groupOrganization,
            registrations,
            members,
            platformFamilyManager: this.platformFamilyManager,
        });
    }

    private async deleteRegistrations(registrations: PlatformRegistration[]) {
        const deleteRegistrations = registrations.map(registration => new RegistrationWithPlatformMember({
            registration,
            member: registration.member,
        }));

        const filteredOrganizations = getUniqueOrganizationsFromRegistrations(registrations);
        if (filteredOrganizations.length === 0) {
            return;
        }

        if (filteredOrganizations.length > 1) {
            Toast.error($t(`%1GV`)).show();
            return;
        }

        return await chooseOrganizationMembersForGroup({
            members: getUniqueMembersFromRegistrations(registrations),
            group: this.groups[0],
            organization: filteredOrganizations[0],
            context: this.context,
            owner: this.owner,
            deleteRegistrations,
            items: [],
            navigate: {
                present: this.present,
                show: this.present,
                pop: () => Promise.resolve(),
                dismiss: () => Promise.resolve(),
            },
        });
    }

    private async exportToExcel(selection: TableActionSelection<PlatformRegistration>) {
        await this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(ExcelExportView, {
                        type: ExcelExportType.Registrations,
                        filter: selection.filter,
                        workbook: getSelectableWorkbook(this.platform, this.organizations.length === 1 ? this.organizations[0] : null, this.groups, this.context.auth),
                        configurationId: 'registrations',
                    }),
                }),
            ],
            modalDisplayStyle: 'popup',
        });
    }

    private async exportToPdf(members: PlatformMember[]) {
        await presentExportMembersToPdf({
            members,
            platform: this.platform,
            organizations: this.organizations,
            groups: this.groups,
            present: this.present,
        });
    }

    private getCategoryTreeOfGroupsLinkedToWaitingList(): null | {categoryTree: GroupCategoryTree, waitingList: Group} {
        const waitingList = this.groups[0];
        const isWaitingList = this.groups.length === 1 && waitingList.type === GroupType.WaitingList && this.organizations.length === 1;
        if (!isWaitingList) {
            return null;
        }

        const organization = this.organizations[0];
        const periods = organization.periods && this.context.auth.hasFullAccess() ? organization.periods.organizationPeriods.filter(p => !p.period.locked) : [organization.period];
        const period = periods.find(p => p.period.id === waitingList.periodId);
        if (!period) {
            return null;
        }

        const categoryTree = period.getCategoryTree({
            admin: true,
            filterGroups: group => group.waitingList !== null && group.waitingList.id === waitingList.id
        });

        return {
            categoryTree,
            waitingList
        }
    }

    private async inviteForGroup(registrations: PlatformRegistration[], group: Group, wereItemsFetched: boolean) {
        return await inviteMembersForGroup({
            members: getUniqueMembersFromRegistrations(registrations),
            group,
            context: this.context,
            owner: this.owner,
            wereItemsFetched
        })
    }

    private async deleteInvitations(registrations: PlatformRegistration[], group: Group, wereItemsFetched: boolean) {
        await deleteInvitationsForMembers({
            members: getUniqueMembersFromRegistrations(registrations),
            group,
            context: this.context,
            owner: this.owner,
            wereItemsFetched
        })
    }

    getInviteMemberForGroupActionsWithGroups(eventGroups: Group[]): {actions: TableAction<PlatformRegistration>[], groups: Group[]} | null {
        const categoryTree = getCategoryTreeOfGroupsLinkedToWaitingList({waitingList: this.groups[0], organization: this.organizations[0], hasFullAccess: this.context.auth.hasFullAccess()});

        if (!categoryTree) {
            return null;
        }

        const enabled = this.hasWrite;

        const allGroups = categoryTree.getAllGroups().concat(eventGroups);
        if (allGroups.length === 0) {
            return null;
        }
        
        if (allGroups.length === 1) {
            const group = allGroups[0];
            const actions = [
                new InMemoryTableAction({
                    name: $t('Toelaten om in te schrijven'),
                    icon: 'success',
                    priority: 15,
                    groupIndex: 2,
                    enabled,
                    needsSelection: true,
                    allowAutoSelectAll: false,
                    // disable if already invited
                    disableIfAll: (registration: PlatformRegistration) => isMemberInvited(registration.member, group),
                    handler: async (registrations: PlatformRegistration[], wereItemsFetched: boolean) => {
                        await this.inviteForGroup(registrations, group, wereItemsFetched)
                    }
                }),

                new InMemoryTableAction({
                    name: $t('Toelating intrekken'),
                    icon: 'canceled',
                    priority: 14,
                    groupIndex: 2,
                    enabled,
                    needsSelection: true,
                    allowAutoSelectAll: false,
                    // disable if not invited
                    disableIfAll: (registration: PlatformRegistration) => !isMemberInvited(registration.member, group),
                    handler: async (registrations: PlatformRegistration[], wereItemsFetched: boolean) => {
                        await this.deleteInvitations(registrations, group, wereItemsFetched)
                    }
                }),
            ];

            return { actions, groups: allGroups };
        }

        const getChildActions = ({action, disableIfAll}: {action: (items: PlatformRegistration[], group: Group, wereItemsFetched: boolean) => void | Promise<void>, disableIfAll: (registration: PlatformRegistration, group: Group) => boolean}) => {
            const childActions = [];

            if (eventGroups.length > 0) {
                childActions.push(new MenuTableAction({
                    name: $t('Activiteiten'),
                    groupIndex: 0,
                    enabled,
                    childActions: () => eventGroups.map((g) => {
                        return new InMemoryTableAction({
                            name: g.settings.name.toString(),
                            needsSelection: true,
                            allowAutoSelectAll: false,
                            disableIfAll: (item) => disableIfAll(item, g),
                            handler: async (items: PlatformRegistration[], wereItemsFetched: boolean) => {
                                await action(items, g, wereItemsFetched);
                            },
                        })
                    }),
                }));
            }

            return childActions.concat(getActionsForCategory<PlatformRegistration>(categoryTree, action, disableIfAll));
        }

        const actions = [
            new MenuTableAction({
                name: $t(`Inschrijven toelaten voor`),
                priority: 2,
                groupIndex: 2,
                needsSelection: true,
                allowAutoSelectAll: false,
                enabled,
                childActions: () => getChildActions({
                    // disable if already invited
                    disableIfAll: (registration: PlatformRegistration, group: Group) => isMemberInvited(registration.member, group),
                    action: async (registrations, group, wereItemsFetched: boolean) => await this.inviteForGroup(registrations, group, wereItemsFetched)
                })
            }),
            new MenuTableAction({
                name: $t(`Toelating intrekken voor`),
                priority: 1,
                groupIndex: 2,
                needsSelection: true,
                allowAutoSelectAll: false,
                enabled,
                childActions: () => getChildActions({
                    // disable if not invited
                    disableIfAll: (registration: PlatformRegistration, group: Group) => !isMemberInvited(registration.member, group),
                    action: async (registrations, group, wereItemsFetched: boolean) => await this.deleteInvitations(registrations, group, wereItemsFetched)
                })
            })
        ];

        return { actions, groups: allGroups };
    }
}

function getUniqueMembersFromRegistrations(registrations: PlatformRegistration[]): PlatformMember[] {
    const allMembers = registrations.map(r => r.member);
    const uniqueMemberIds = new Set(allMembers.map(m => m.id));
    return [...uniqueMemberIds].map(id => allMembers.find(m => m.id === id)!);
}

function getUniqueOrganizationsFromRegistrations(registrations: PlatformRegistration[]): Organization[] {
    const allOrganinizationIds = Formatter.uniqueArray(registrations.map(r => r.organizationId));
    return allOrganinizationIds.map(id => registrations.find(r => r.organizationId === id)!.member.organizations.find(o => o.id === id)!).filter(o => !!o);
}
