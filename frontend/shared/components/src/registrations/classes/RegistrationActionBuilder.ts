import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { ExcelExportView } from '@stamhoofd/frontend-excel-export';
import { SessionContext, useRequestOwner } from '@stamhoofd/networking';
import { ExcelExportType, Group, GroupType, Organization, OrganizationRegistrationPeriod, PermissionLevel, Platform, PlatformMember, PlatformRegistration, RegistrationWithPlatformMember } from '@stamhoofd/structures';
import { useContext, useOrganization, usePlatform } from '../../hooks';
import { checkoutDefaultItem, chooseOrganizationMembersForGroup, getActionsForCategory, PlatformFamilyManager, presentDeleteMembers, presentEditMember, presentEditResponsibilities, usePlatformFamilyManager } from '../../members';
import { RegistrationsActionBuilder } from '../../members/classes/RegistrationsActionBuilder';
import { AsyncTableAction, InMemoryTableAction, MenuTableAction, TableAction, TableActionSelection } from '../../tables';
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

    getActions(options: { includeDeleteMember?: boolean; includeMove?: boolean; includeEdit?: boolean; selectedOrganizationRegistrationPeriod?: OrganizationRegistrationPeriod } = {}) {
        const actions: TableAction<PlatformRegistration>[] = [
            ...this.getMemberActions(),
            // todo: e-mail
            // todo: export excel
            this.getExportToExcelAction(),
            (options.includeMove ? this.getMoveAction(options.selectedOrganizationRegistrationPeriod) : null),
            (options.includeEdit ? this.getEditAction() : null),
            (options.includeDeleteMember ? this.getDeleteMemberAction() : null),
            this.getUnsubscribeAction(),
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
                        presentEditMember({ member: registrations[0].member, present: this.present }).catch(console.error);
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

            // todo: delete
        ];

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
        if (this.groups.length !== 1) {
            return null;
        }

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

    private getDeleteMemberAction() {
        return new InMemoryTableAction({
            name: $t('Lid definitief verwijderen'),
            destructive: true,
            priority: 1,
            groupIndex: 100,
            needsSelection: true,
            singleSelection: true,
            allowAutoSelectAll: false,
            icon: 'trash',
            enabled: !this.context.organization && this.context.auth.hasPlatformFullAccess(),
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
        if (this.organizations.length !== 1 || this.groups.filter(g => g.type !== GroupType.EventRegistration).length === 0) {
            console.error('Cannot move registrations');
            return null;
        }

        const organization = this.organizations[0];
        const period = selectedOrganizationRegistrationPeriod ?? organization.period;

        return new MenuTableAction({
            name: $t(`507c48cb-35ae-4c94-bc7a-4611360409c8`),
            priority: 1,
            groupIndex: 5,
            needsSelection: true,
            allowAutoSelectAll: false,
            enabled: this.hasWrite,
            childActions: () => [
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

    private getExportToExcelAction() {
        return new AsyncTableAction({
            name: $t(`0302eaa0-ce2a-4ef0-b652-88b26b9c53e9`),
            icon: 'download',
            priority: 11,
            groupIndex: 3,
            handler: async (selection: TableActionSelection<PlatformRegistration>) => {
                // TODO: vervangen door een context menu
                await this.exportToExcel(selection);
            },
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

        return await chooseOrganizationMembersForGroup({
            members: getUniqueMembersFromRegistrations(registrations),
            group: this.groups[0],
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
}

function getUniqueMembersFromRegistrations(registrations: PlatformRegistration[]): PlatformMember[] {
    const allMembers = registrations.map(r => r.member);
    const uniqueMemberIds = new Set(allMembers.map(m => m.id));
    return [...uniqueMemberIds].map(id => allMembers.find(m => m.id === id)!);
}
