import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { ExcelExportView } from '@stamhoofd/frontend-excel-export';
import { SessionContext, useRequestOwner } from '@stamhoofd/networking';
import { EmailRecipientFilterType, EmailRecipientSubfilter, ExcelExportType, Group, mergeFilters, Organization, OrganizationRegistrationPeriod, PermissionLevel, PermissionsResourceType, Platform, PlatformMember, PlatformRegistration, RegistrationWithPlatformMember } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { AuditLogsView } from '../../audit-logs';
import { CommunicationView } from '../../communication';
import { LoadComponent } from '../../containers/AsyncComponent';
import { EmailView, RecipientChooseOneOption } from '../../email';
import { useContext, useOrganization, usePlatform } from '../../hooks';
import { checkoutDefaultItem, chooseOrganizationMembersForGroup, getActionsForCategory, PlatformFamilyManager, presentDeleteMembers, presentEditMember, presentEditResponsibilities, presentExportMembersToPdf, usePlatformFamilyManager } from '../../members';
import { RegistrationsActionBuilder } from '../../members/classes/RegistrationsActionBuilder';
import { Toast } from '../../overlays/Toast';
import { AsyncTableAction, InMemoryTableAction, MenuTableAction, TableAction, TableActionSelection } from '../../tables';
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
                name: $t(`28f20fae-6270-4210-b49d-68b9890dbfaf`),
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
                name: $t(`331c7c4f-7317-4ec5-b9eb-02f324129ee1`),
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
                name: $t(`800d8458-da0f-464f-8b82-4e28599c8598`),
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
                    name: $t(`26a122e0-4312-4473-90c6-85f5c9f678be`) + ' ' + org.name,
                    groupIndex: 0,
                    childActions: () => this.getRegisterActions(org),
                });
            });
        }

        return [
            new MenuTableAction({
                name: $t(`93d604bc-fddf-434d-a993-e6e456d32231`),
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
            name: $t(`69aaebd1-f031-4237-8150-56e377310cf5`),
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
            name: $t(`d799bffc-fd09-4444-abfa-3552b3c46cb9`),
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
                name: $t(`a5cf8db3-5fb8-4a4c-9940-31d758433f23`),
                priority: 1,
                groupIndex: 6,
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (registations: PlatformRegistration[]) => {
                    const members = getUniqueMembersFromRegistrations(registations);
                    if (members.length > 100) {
                        Toast.error($t(`dc5db5f5-4027-42fa-a998-1535e2c3a82a`)).show();
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
                name: $t(`82a881a0-5666-4649-961a-c8f6c48177d0`),
                priority: 1,
                groupIndex: 6,
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (registations: PlatformRegistration[]) => {
                    const members = getUniqueMembersFromRegistrations(registations);
                    if (members.length > 100) {
                        Toast.error($t(`dc5db5f5-4027-42fa-a998-1535e2c3a82a`)).show();
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
            name: $t('d20e1a65-6c0d-4591-9dac-1abc01b9a563'),
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
            name: $t(`507c48cb-35ae-4c94-bc7a-4611360409c8`),
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
                    name: $t(`93d604bc-fddf-434d-a993-e6e456d32231`),
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
            name: $t(`ffe15b57-4e70-4657-9a0b-af860eed503e`),
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
            name: $t('2a50d0e8-bdb9-4016-84be-b0de6e26ca14'),
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
            name: $t('b9f2cf39-1f26-4b7c-b949-0474fa9f2f01'),
            priority: 0,
            groupIndex: 0,
            handler: async (selection: TableActionSelection<PlatformRegistration>) => {
                await this.exportToExcel(selection);
            },
        });
    }

    private getExportToPdfAction() {
        return new InMemoryTableAction({
            name: $t('3bfdcad4-7201-4b4e-9244-5ec22c6e4ce9'),
            priority: 0,
            groupIndex: 0,
            fetchLimitSettings: { limit: 500, createErrorMessage: (count, limit) => {
                return $t('03903ede-4f60-4358-8709-bfc814ee5b17', { count: Formatter.float(count), limit: Formatter.float(limit) });
            } },
            handler: async (registrations: PlatformRegistration[]) => {
                await this.exportToPdf(registrations.map(r => r.member));
            },
        });
    }

    private getEmailAction() {
        return new AsyncTableAction({
            name: $t(`208ae3f1-1720-4d79-96fd-5c05d97c9de0`),
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
            name: $t(`73d85ece-245e-4e48-a833-1e78cf810b03`),
            icon: 'feedback-line',
            priority: 9,
            groupIndex: 3,
            fetchLimitSettings: { limit: 200, createErrorMessage: (count, limit) => {
                return $t('187d5767-969d-407a-a988-c3a9a831a0a8', { count: Formatter.float(count), limit: Formatter.float(limit) });
            } },
            handler: async (registrations: PlatformRegistration[]) => {
                await this.openSms(registrations);
            },
        });
    }

    private async openSms(registrations: PlatformRegistration[]) {
        const displayedComponent = await LoadComponent(() => import(/* webpackChunkName: "SMSView" */ '@stamhoofd/components/src/views/SMSView.vue'), {
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
                    name: $t(`379d43fb-034f-4280-bb99-ea658eaec729`),
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
                    name: $t(`2035a033-bd26-492b-8d91-473b2a033029`),
                    value: [],
                },
                {
                    id: 'adults',
                    name: $t(`756cf0cd-8992-452a-9eb8-46e1c7ca5650`),
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
                    name: $t(`f6b27311-6878-4d14-90de-7a49a7f2b8f2`),
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
                    name: $t(`5c6c917c-c07c-4825-9f58-a8dade4e4875`),
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
                    name: $t(`71065f0c-5d13-4b38-ba35-9b17aca66fbf`),
                    value: [],
                },
            ],
        });

        options.push({
            type: 'ChooseOne',
            options: [
                {
                    id: 'none',
                    name: $t(`2f4a25b4-1c98-4449-9ba1-75418393f0c9`),
                    value: [],
                },
                {
                    id: 'minors',
                    name: $t(`62844f9d-a3d3-4b83-bafe-e8e97bc6aa3b`),
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
                    name: $t(`09c2a259-7c8f-4a97-8eb2-05fa9d56865e`),
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
            Toast.error($t(`b2dffb50-f8b1-4211-83d2-49a7b4008508`)).show();
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
