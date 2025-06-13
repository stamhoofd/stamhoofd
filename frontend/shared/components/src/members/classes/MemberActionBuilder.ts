import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { ExcelExportView } from '@stamhoofd/frontend-excel-export';
import { SessionContext, useRequestOwner } from '@stamhoofd/networking';
import { EmailRecipientFilterType, EmailRecipientSubfilter, ExcelExportType, Group, GroupCategoryTree, GroupType, MemberWithRegistrationsBlob, Organization, OrganizationRegistrationPeriod, PermissionLevel, Platform, PlatformMember, RegistrationWithPlatformMember, mergeFilters } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { markRaw } from 'vue';
import { EditMemberAllBox, MemberSegmentedView, MemberStepView, checkoutDefaultItem, chooseOrganizationMembersForGroup } from '..';
import { GlobalEventBus } from '../../EventBus';
import { AuditLogsView } from '../../audit-logs';
import { LoadComponent } from '../../containers/AsyncComponent';
import EmailView, { RecipientChooseOneOption } from '../../email/EmailView.vue';
import MembersPdfExportView from '../../export/MembersPdfExportView.vue';
import { manualFeatureFlag, useContext, useOrganization, usePlatform } from '../../hooks';
import ChargeMembersView from '../../members/ChargeMembersView.vue';
import { Toast } from '../../overlays/Toast';
import { AsyncTableAction, InMemoryTableAction, MenuTableAction, TableAction, TableActionSelection } from '../../tables/classes';
import { NavigationActions } from '../../types/NavigationActions';
import DeleteView from '../../views/DeleteView.vue';
import { PlatformFamilyManager, usePlatformFamilyManager } from '../PlatformFamilyManager';
import EditMemberResponsibilitiesBox from '../components/edit/EditMemberResponsibilitiesBox.vue';
import { RegistrationsActionBuilder } from './RegistrationsActionBuilder';
import { getSelectablePdfDocument } from './getPdfDocuments';
import { getSelectableWorkbook } from './getSelectableWorkbook';

export function useDirectMemberActions(options?: { groups?: Group[]; organizations?: Organization[] }) {
    return useMemberActions()(options);
}

export function useMemberActions() {
    const present = usePresent();
    const context = useContext();
    const platformFamilyManager = usePlatformFamilyManager();
    const owner = useRequestOwner();
    const organization = useOrganization();
    const platform = usePlatform();

    return (options?: { groups?: Group[]; organizations?: Organization[]; forceWriteAccess?: boolean | null }) => {
        return new MemberActionBuilder({
            present,
            platform: platform.value,
            context: context.value,
            groups: options?.groups ?? [],
            organizations: organization.value ? [organization.value] : (options?.organizations ?? []),
            platformFamilyManager,
            owner,
            forceWriteAccess: options?.forceWriteAccess,
        });
    };
}

export class MemberActionBuilder {
    /**
     * Determines which registrations will get moved or removed
     */
    groups: Group[];
    platform: Platform;

    /**
     * Determines what to move or register the members to
     */
    organizations: Organization[];

    present: ReturnType<typeof usePresent>;
    context: SessionContext;
    platformFamilyManager: PlatformFamilyManager;
    owner: any;

    forceWriteAccess: boolean | null = null;

    constructor(settings: {
        present: ReturnType<typeof usePresent>;
        context: SessionContext;
        groups: Group[];
        platform: Platform;
        organizations: Organization[];
        platformFamilyManager: PlatformFamilyManager;
        owner: any;
        forceWriteAccess?: boolean | null;
    }) {
        this.present = settings.present;
        this.context = settings.context;
        this.platform = settings.platform;
        this.groups = settings.groups;
        this.organizations = settings.organizations;
        this.platformFamilyManager = settings.platformFamilyManager;
        this.owner = settings.owner;
        this.forceWriteAccess = settings.forceWriteAccess ?? null;
    }

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

    getRegistrationActionBuilder(members: PlatformMember[]) {
        if (this.organizations.length !== 1) {
            return;
        }

        const groupOrganization = this.organizations[0];
        const registrations = members.flatMap(m => m.filterRegistrations({ groups: this.groups, organizationId: groupOrganization.id }));

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

    getRegisterActions(organization?: Organization): TableAction<PlatformMember>[] {
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
                            handler: async (members: PlatformMember[]) => {
                                await this.register(members, g);
                            },
                        });
                    }),
                ],
            }),
            ...getActionsForCategory<PlatformMember>(organization.period.adminCategoryTree, async (members, group) => await this.register(members, group)).map((r) => {
                r.description = organization.period.period.name;
                return r;
            }),
        ];
    }

    private getDeleteAction() {
        return [new InMemoryTableAction({
            name: $t('d20e1a65-6c0d-4591-9dac-1abc01b9a563'),
            destructive: true,
            priority: 1,
            groupIndex: 100,
            needsSelection: true,
            singleSelection: true,
            allowAutoSelectAll: false,
            icon: 'trash',
            enabled: !this.context.organization && this.context.auth.hasPlatformFullAccess(),
            handler: async (members: PlatformMember[]) => {
                await presentDeleteMembers({
                    members,
                    present: this.present,
                    platformFamilyManager: this.platformFamilyManager,
                });
            },
        })];
    }

    getMoveAction(selectedOrganizationRegistrationPeriod?: OrganizationRegistrationPeriod): TableAction<PlatformMember>[] {
        if (this.organizations.length !== 1) {
            return [];
        }

        if (this.groups.filter(g => g.type !== GroupType.EventRegistration).length === 0) {
            return [];
        }

        const organization = this.organizations[0];
        const period = selectedOrganizationRegistrationPeriod ?? organization.period;

        return [
            new MenuTableAction({
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
                                    handler: async (members: PlatformMember[]) => {
                                        await this.moveRegistrations(members, g);
                                    },
                                });
                            }),
                        ],
                    }),
                    ...getActionsForCategory<PlatformMember>(period.adminCategoryTree, (members, group) => this.moveRegistrations(members, group)).map((r) => {
                        r.description = period.period.name;
                        return r;
                    }),
                ],
            }),
        ];
    }

    getAuditLogAction(): TableAction<PlatformMember>[] {
        if ((this.organizations.length !== 1 || this.organizations[0].id !== this.context.organization?.id) && !this.context.auth.hasPlatformFullAccess()) {
            return [];
        }

        if (this.organizations.length === 1 && this.organizations[0].id === this.context.organization?.id && !this.context.auth.hasFullAccess()) {
            return [];
        }

        if (!manualFeatureFlag('audit-logs', this.context)) {
            return [];
        }

        return [
            new InMemoryTableAction({
                name: $t(`a5cf8db3-5fb8-4a4c-9940-31d758433f23`),
                priority: 1,
                groupIndex: 6,
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (members: PlatformMember[]) => {
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

    getEditAction(): TableAction<PlatformMember>[] {
        if (this.organizations.length !== 1 || this.groups.length === 0) {
            return [];
        }

        return [
            new InMemoryTableAction({
                name: $t(`ffe15b57-4e70-4657-9a0b-af860eed503e`),
                priority: 1,
                groupIndex: 1,
                needsSelection: true,
                allowAutoSelectAll: false,
                enabled: this.hasWrite,
                handler: async (members: PlatformMember[]) => {
                    await this.editRegistrations(members);
                },
                icon: 'edit',
            }),
        ];
    }

    getUnsubscribeAction(): TableAction<PlatformMember>[] {
        if (this.groups.length === 0) {
            return [];
        }

        return [new InMemoryTableAction({
            name: $t(`69aaebd1-f031-4237-8150-56e377310cf5`),
            destructive: true,
            priority: 0,
            groupIndex: 7,
            needsSelection: true,
            allowAutoSelectAll: false,
            enabled: this.hasWrite,
            handler: async (members) => {
                await this.deleteRegistration(members);
            },
        })];
    }

    getChargeAction(organization: Organization) {
        return new AsyncTableAction({
            name: $t(`d799bffc-fd09-4444-abfa-3552b3c46cb9`),
            icon: 'calculator',
            priority: 13,
            groupIndex: 4,
            handler: async (selection: TableActionSelection<PlatformMember>) => {
                await this.present({
                    modalDisplayStyle: 'popup',
                    components: [
                        new ComponentWithProperties(ChargeMembersView, {
                            filter: selection.filter.filter,
                            organization,
                        }),
                    ],
                });
            },
        });
    }

    editResponsibilities(member: PlatformMember) {
        presentEditMember({ member, present: this.present }).catch(console.error);
    }

    getActions(options: { includeDelete?: boolean; includeMove?: boolean; includeEdit?: boolean; selectedOrganizationRegistrationPeriod?: OrganizationRegistrationPeriod } = {}): TableAction<PlatformMember>[] {
        const actions = [
            new InMemoryTableAction({
                name: $t(`28f20fae-6270-4210-b49d-68b9890dbfaf`),
                icon: 'edit',
                priority: 2,
                groupIndex: 1,
                needsSelection: true,
                singleSelection: true,
                enabled: this.hasWrite,
                handler: (members: PlatformMember[]) => {
                    this.editResponsibilities(members[0]);
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
                handler: (members: PlatformMember[]) => {
                    presentEditResponsibilities({ member: members[0], present: this.present }).catch(console.error);
                },
            }),

            new AsyncTableAction({
                name: $t(`f92ad3ab-8743-4d37-8b3f-c9d5ca756b16`),
                icon: 'email',
                priority: 12,
                groupIndex: 3,
                handler: async (selection: TableActionSelection<PlatformMember>) => {
                    await this.openMail(selection);
                },
            }),
            this.getSmsAction(),
            this.getExportAction(),
            new MenuTableAction({
                name: $t(`800d8458-da0f-464f-8b82-4e28599c8598`),
                priority: 1,
                groupIndex: 5,
                needsSelection: true,
                allowAutoSelectAll: false,
                enabled: this.hasWrite && !!this.context.organization,
                childActions: () => this.getRegisterActions(),
            }),
            ...(options.includeMove ? this.getMoveAction(options.selectedOrganizationRegistrationPeriod) : []),
            ...(options.includeEdit ? this.getEditAction() : []),
            ...(options.includeDelete ? this.getDeleteAction() : []),
            ...this.getUnsubscribeAction(),
            ...this.getAuditLogAction(),
        ];

        return actions;
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
            handler: async (members: PlatformMember[]) => {
                await this.openSms(members);
            },
        });
    }

    private async openSms(members: PlatformMember[]) {
        const displayedComponent = await LoadComponent(() => import(/* webpackChunkName: "SMSView" */ '@stamhoofd/components/src/views/SMSView.vue'), {
            members: members.map(pm => pm.member),
        });
        this.present(displayedComponent.setDisplayStyle('popup')).catch(console.error);
    }

    // Action implementations
    async openMail(selection: TableActionSelection<PlatformMember>) {
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
                            type: EmailRecipientFilterType.Members,
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
                            type: EmailRecipientFilterType.Members,
                            filter: mergeFilters([
                                filter,
                                {
                                    age: {
                                        $gt: 17,
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
                            type: EmailRecipientFilterType.MemberParents,
                            filter: mergeFilters([
                                filter,
                                {
                                    age: {
                                        $lt: 18,
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
                            type: EmailRecipientFilterType.MemberParents,
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
                            type: EmailRecipientFilterType.MemberUnverified,
                            filter: mergeFilters([
                                filter,
                                {
                                    age: {
                                        $lt: 18,
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
                            type: EmailRecipientFilterType.MemberUnverified,
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
            }),
        });
        await this.present({
            components: [
                displayedComponent,
            ],
            modalDisplayStyle: 'popup',
        });
    }

    async showMember(member: PlatformMember) {
        const component = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MemberSegmentedView, {
                member,
            }),
        });

        await this.present({
            components: [component],
            modalDisplayStyle: 'popup',
        });
    }

    private getExportAction() {
        return new MenuTableAction({
            name: 'Exporteren naar',
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
            name: $t('Excel...'),
            priority: 0,
            groupIndex: 0,
            handler: async (selection: TableActionSelection<PlatformMember>) => {
                await this.exportToExcel(selection);
            },
        });
    }

    async exportToExcel(selection: TableActionSelection<PlatformMember>) {
        await this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(ExcelExportView, {
                        type: ExcelExportType.Members,
                        filter: selection.filter,
                        workbook: getSelectableWorkbook(this.platform, this.organizations.length === 1 ? this.organizations[0] : null, this.groups, this.context.auth),
                        configurationId: 'members',
                    }),
                }),
            ],
            modalDisplayStyle: 'popup',
        });
    }

    private getExportToPdfAction() {
        return new InMemoryTableAction({
            name: $t('PDF...'),
            priority: 0,
            groupIndex: 0,
            fetchLimitSettings: { limit: 200, createErrorMessage: (count, limit) => {
                return $t('Je kan maximaal {limit} leden exporteren naar pdf. Er zijn {count} leden geselecteerd.', { count: Formatter.float(count), limit: Formatter.float(limit) });
            } },
            handler: async (members: PlatformMember[]) => {
                await this.exportToPdf(members);
            },
        });
    }

    private async exportToPdf(members: PlatformMember[]) {
        await presentExportMembersToPdf({
            members,
            platform: this.platform,
            organizations: this.organizations,
            groups: this.groups,
            context: this.context,
            present: this.present,
        });
    }

    async deleteRegistration(members: PlatformMember[]) {
        const deleteRegistrations = members.flatMap(member => member.filterRegistrations({ groups: this.groups }).map(registration => new RegistrationWithPlatformMember({
            registration,
            member,
        })));
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
                dismiss: () => Promise.resolve(),
            },
        });
    }

    get groupIds() {
        return this.groups?.map(g => g.id) ?? [];
    }

    async moveRegistrations(members: PlatformMember[], group: Group) {
        return this.getRegistrationActionBuilder(members)?.moveRegistrations(group);
    }

    async editRegistrations(members: PlatformMember[]) {
        return this.getRegistrationActionBuilder(members)?.editRegistrations();
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
}

export function getActionsForCategory<T extends { id: string }>(category: GroupCategoryTree, action: (items: T[], group: Group) => void | Promise<void>): TableAction<T>[] {
    const r = [
        ...category.categories.map((c) => {
            return new MenuTableAction({
                name: c.settings.name,
                groupIndex: 2,
                needsSelection: true,
                allowAutoSelectAll: false,
                enabled: c.groups.length > 0 || c.categories.length > 0,
                childActions: getActionsForCategory(c, action),
            });
        }),
        ...category.groups.map((g) => {
            return new InMemoryTableAction({
                name: g.settings.name.toString(),
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (items: T[]) => {
                    await action(items, g);
                },
            });
        }),
    ];

    if (r.filter(rr => rr.enabled).length === 1) {
        const rr = r.filter(rr => rr.enabled)[0];
        if (rr instanceof MenuTableAction && Array.isArray(rr.childActions)) {
            return rr.childActions;
        }
    }

    return r;
}

export async function presentEditMember({ member, present }: { member: PlatformMember; present: ReturnType<typeof usePresent> }) {
    await present({
        components: [
            new ComponentWithProperties(MemberStepView, {
                member,
                title: member.member.firstName + ' ' + $t(`ee3bc635-c294-4134-9155-7a74f47dec4f`),
                component: markRaw(EditMemberAllBox),
                saveHandler: async ({ dismiss }: NavigationActions) => {
                    await dismiss({ force: true });
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

export async function presentEditResponsibilities({ member, present }: { member: PlatformMember; present: ReturnType<typeof usePresent> }) {
    await present({
        components: [
            new ComponentWithProperties(MemberStepView, {
                member,
                title: $t(`53ffa1a5-9b55-4ff9-9c97-eeaf54ce6b47`) + ' ' + member.member.firstName,
                component: markRaw(EditMemberResponsibilitiesBox),
                saveHandler: async ({ dismiss }: NavigationActions) => {
                    await dismiss({ force: true });
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

export async function presentDeleteMembers({ members, present, platformFamilyManager }: { members: PlatformMember[]; present: ReturnType<typeof usePresent>; platformFamilyManager: PlatformFamilyManager }) {
    if (members.length > 1) {
        throw new SimpleError({
            code: 'not-supported',
            message: $t('2fcd7b68-2fd1-4b8c-afae-4dc60dcd96a5'),
        });
    }

    const member = members[0].patchedMember;
    const name = member.name;

    await present({
        components: [
            new ComponentWithProperties(DeleteView, {
                title: $t('802581b7-38dd-45c3-815d-b786b6f9136c', { name }),
                description: $t(`dfbecccd-b964-4e8b-83e4-553b49d9fcc0`, { name }),
                confirmationTitle: $t(`c15132d6-f507-46eb-8584-e36e7ce343c5`),
                confirmationPlaceholder: $t(`e4b3d2af-dee8-4f55-88e9-a229513d347c`),
                confirmationCode: name,
                checkboxText: $t(`738eb984-4a2e-455d-b6d5-5204173039dc`),
                onDelete: async () => {
                    const patch = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;
                    for (const member of members) {
                        patch.addDelete(member.id);
                    }

                    await platformFamilyManager.isolatedPatch(members, patch);
                    GlobalEventBus.sendEvent('members-deleted', members).catch(console.error);

                    Toast.success(
                        members.length ? $t('cb9fd3d2-c563-4d46-a26b-4438e5a887ef') : $t('43300d52-0e3f-4189-b5b3-100ecb0f5e70', { count: members.length }),
                    ).show();
                    return true;
                },
            }),
        ],
        modalDisplayStyle: 'sheet',
    });
}

export async function presentExportMembersToPdf({ members, platform, organizations, groups, present, context }: { members: PlatformMember[]; platform: Platform; organizations: Organization[]; groups: Group[]; present: ReturnType<typeof usePresent>; context: SessionContext }) {
    const selectableDocument = getSelectablePdfDocument({ platform, organization: organizations.length === 1 ? organizations[0] : null, groups, auth: context.auth });

    const group = groups.length === 1 ? groups[0] : undefined;

    let documentTitle = $t('Samenvatting');

    if (group) {
        documentTitle += ' ' + group.settings.name;
    }

    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(MembersPdfExportView, {
                    selectableDocument,
                    configurationId: 'members',
                    items: members,
                    documentTitle,
                }),
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}
