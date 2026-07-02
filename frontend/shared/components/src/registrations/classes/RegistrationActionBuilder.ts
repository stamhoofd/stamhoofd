import { LoadComponent } from '#containers/AsyncComponent';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import type { RecipientChooseOneOption } from '#email/EmailView.vue';
import { useContext } from '#hooks/useContext.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import type { PlatformFamilyManager } from '#members/PlatformFamilyManager.ts';
import { usePlatformFamilyManager } from '#members/PlatformFamilyManager.ts';
import { checkoutDefaultItem, chooseOrganizationMembersForGroup } from '#members/checkout/useCheckoutRegisterItem.ts';
import { getActionsForCategory, inviteMembersForGroup, isMemberInvited, isMemberRegistered, presentDeleteMembers, presentEditMember, presentEditResponsibilities, presentExportMembersToPdf } from '#members/classes/MemberActionBuilder.ts';
import { RegistrationInvitationEventBus } from '#registrations/classes/useRegistrationInvitationEventListener.ts';
import { fetchAll } from '#tables/classes/ObjectFetcher.ts';
import type { TableAction, TableActionSelection } from '#tables/classes/TableAction.ts';
import { AsyncTableAction, InMemoryTableAction, MenuTableAction } from '#tables/classes/TableAction.ts';
import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import type { SessionContext } from '@stamhoofd/networking/SessionContext';
import { useFetchOrganizationRegistrationPeriods } from '@stamhoofd/networking/hooks/useFetchOrganizationRegistrationPeriods';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import type { Group, GroupCategoryTree, Organization, OrganizationRegistrationPeriod, Platform, PlatformMember, PlatformRegistration, RegistrationInvitationRequest } from '@stamhoofd/structures';
import { EmailRecipientSubfilter, ExcelExportType, GroupType, LimitedFilteredRequest, mergeFilters, PermissionLevel, PermissionsResourceType, RegistrationWithPlatformMember } from '@stamhoofd/structures';
import { EmailRecipientFilterType } from '@stamhoofd/structures/email/EmailRecipientFilterType.js';
import { Formatter } from '@stamhoofd/utility';
import { useGroupsObjectFetcher } from '../../fetchers/useGroupsObjectsFetcher';
import { RegistrationsActionBuilder } from '../../members/classes/RegistrationsActionBuilder';
import { Toast } from '../../overlays/Toast';
import { getSelectableWorkbook } from './getSelectableWorkbook';

export function useDirectRegistrationActions(options?: {
    groups?: Group[];
    organizations?: Organization[];
    categories?: GroupCategoryTree[];
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
    const fetchOrganizationPeriods = useFetchOrganizationRegistrationPeriods();

    return (options?: { groups?: Group[];
        organizations?: Organization[];
        categories?: GroupCategoryTree[];
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
            categories: options?.categories ?? [],
            fetchOrganizationPeriods,
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
    private readonly isWaitingList: boolean;
    private eventGroupsLinkedToWaitingList: Group[] | null = null;
    private _allGroupsLinkedToWaitingList: Group[] | null = null;
    private categories: GroupCategoryTree[];
    private fetchOrganizationPeriods?: ReturnType<typeof useFetchOrganizationRegistrationPeriods>;

    /** Cache of periods, loadResolvedPeriods fills in */
    private resolvedPeriods: OrganizationRegistrationPeriod[] | null = null;

    get allGroupsLinkedToWaitingList() {
        return this._allGroupsLinkedToWaitingList?.slice() ?? [];
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

    constructor(settings: {
        present: ReturnType<typeof usePresent>;
        context: SessionContext;
        groups: Group[];
        platform: Platform;
        organizations: Organization[];
        platformFamilyManager: PlatformFamilyManager;
        forceWriteAccess?: boolean | null;
        owner: any;
        categories: GroupCategoryTree[];
        fetchOrganizationPeriods?: ReturnType<typeof useFetchOrganizationRegistrationPeriods>;
    }) {
        this.present = settings.present;
        this.context = settings.context;
        this.groups = settings.groups;
        this.organizations = settings.organizations;
        this.platformFamilyManager = settings.platformFamilyManager;
        this.owner = settings.owner;
        this.forceWriteAccess = settings.forceWriteAccess ?? null;
        this.platform = settings.platform;
        this.isWaitingList = this.groups.length === 1 && this.groups[0].type === GroupType.WaitingList;
        this.categories = settings.categories;
        this.fetchOrganizationPeriods = settings.fetchOrganizationPeriods;
    }

    /** Resolve (and cache) the organization periods */
    private async loadResolvedPeriods(selectedOrganizationRegistrationPeriod?: OrganizationRegistrationPeriod): Promise<void> {
        if (this.organizations.length !== 1) {
            this.resolvedPeriods = [];
            return;
        }

        const organization = this.organizations[0];
        const fallback = [selectedOrganizationRegistrationPeriod ?? organization.period];

        // Only the context organization's periods can be fetched, and only full-access users may switch periods.
        if (!this.context.auth.hasFullAccess() || !this.fetchOrganizationPeriods || this.context.organization?.id !== organization.id) {
            this.resolvedPeriods = fallback;
            return;
        }

        try {
            const list = await this.fetchOrganizationPeriods({ shouldRetry: true });
            const periods = list.organizationPeriods.filter(p => !p.period.locked);
            this.resolvedPeriods = periods.length > 0 ? periods : fallback;
        } catch (e) {
            console.error('Failed to load organization registration periods', e);
            this.resolvedPeriods = fallback;
        }
    }

    /**
     * Returns the periods to offer for the given organization. The resolved multi-period list
     * only applies to the single context organization; any other organization falls back to its
     * own current period (or the provided fallback).
     */
    private getResolvedPeriods(organization: Organization, fallbackPeriod?: OrganizationRegistrationPeriod): OrganizationRegistrationPeriod[] {
        if (this.organizations.length === 1 && this.organizations[0].id === organization.id && this.resolvedPeriods && this.resolvedPeriods.length > 0) {
            return this.resolvedPeriods;
        }
        return [fallbackPeriod ?? organization.period];
    }

    async getActions(options: { includeMove?: boolean; includeEdit?: boolean; selectedOrganizationRegistrationPeriod?: OrganizationRegistrationPeriod } = {}) {
        await this.loadResolvedPeriods(options.selectedOrganizationRegistrationPeriod);

        const allActions: TableAction<PlatformRegistration>[] = [
            ...this.getMemberActions(),
            this.getEmailAction(),
            this.getSmsAction(),
            this.getExportAction(),
            ...this.getAuditLogAction(),
            ...this.getMessagesAction(),
            ...await this.getInviteMemberForGroupActionsWithGroups(),
        ];

        if (options.includeMove) {
            const moveAction = this.getMoveAction(options.selectedOrganizationRegistrationPeriod);
            if (moveAction) {
                allActions.push(moveAction);
            }
        }

        if (options.includeEdit) {
            const editAction = this.getEditAction();
            if (editAction) {
                allActions.push(editAction);
            }
        }

        const unsubscribeAction = this.getUnsubscribeAction();
        if (unsubscribeAction) {
            allActions.push(unsubscribeAction);
        }

        return allActions;
    }

    private getMemberActions(): TableAction<PlatformRegistration>[] {
        const actions: TableAction<PlatformRegistration>[] = [
            new InMemoryTableAction({
                name: $t(`%XO`),
                icon: 'edit',
                priority: 2,
                groupIndex: 1,
                needsSelection: true,
                singleSelection: true,
                enabled: () => this.hasWrite,
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
                enabled: () => this.context.auth.hasFullAccess(),
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
                enabled: () => this.hasWrite && !!this.context.organization,
                childActions: () => this.getRegisterActions(),
            }),
        ];

        const deleteMemberAction = this.getDeleteMemberAction();
        if (deleteMemberAction) {
            actions.push(deleteMemberAction);
        }

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

        const getForPeriod = (period: OrganizationRegistrationPeriod, addPeriodDescription = false): TableAction<PlatformRegistration>[] => {
            return [
                new MenuTableAction({
                    name: $t(`%eh`),
                    groupIndex: 0,
                    description: addPeriodDescription ? period.period.name : undefined,
                    enabled: () => period.waitingLists.length > 0,
                    childActions: () => [
                        ...period.waitingLists.map((g) => {
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
                ...getActionsForCategory<PlatformRegistration>(period.adminCategoryTree, async (registrations, group) => await this.register(getUniqueMembersFromRegistrations(registrations), group)).map((r) => {
                    if (addPeriodDescription) {
                        r.description = period.period.name;
                    }
                    return r;
                }),
            ];
        };

        const periods = this.getResolvedPeriods(organization);

        if (periods.length > 1) {
            return periods.map((period) => {
                return new MenuTableAction({
                    name: period.period.name,
                    groupIndex: 0,
                    childActions: () => getForPeriod(period, false),
                });
            });
        }
        return getForPeriod(periods[0], true);
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
            icon: 'no-edit',
            destructive: true,
            priority: 10,
            groupIndex: 100,
            needsSelection: true,
            allowAutoSelectAll: false,
            enabled: () => this.hasWrite,
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
                        AsyncComponent(() => import('../ChargeRegistrationsView.vue'), {
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
                            AsyncComponent(() => import('#audit-logs/AuditLogsView.vue'), {
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
                                root: AsyncComponent(() => import('#communication/CommunicationView.vue'), {
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
        const enabled = () => (STAMHOOFD.userMode === 'platform' ? (!this.context.organization && this.context.auth.hasPlatformFullAccess()) : this.context.auth.hasFullAccess());
        if (!enabled()) {
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
        const periods = this.getResolvedPeriods(organization, selectedOrganizationRegistrationPeriod);

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

        const getForPeriod = (period: OrganizationRegistrationPeriod, addPeriodDescription = false): TableAction<PlatformRegistration>[] => {
            return [
                new MenuTableAction({
                    name: $t(`%eh`),
                    groupIndex: 1,
                    description: addPeriodDescription ? period.period.name : undefined,
                    enabled: () => period.waitingLists.length > 0,
                    childActions: () => [
                        ...period.waitingLists.map((g) => {
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
                    if (addPeriodDescription) {
                        r.description = period.period.name;
                    }
                    return r;
                }),
            ];
        };

        return new MenuTableAction({
            name: $t(`%HB`),
            priority: 1,
            groupIndex: 5,
            needsSelection: true,
            allowAutoSelectAll: false,
            enabled: () => this.hasWrite,
            childActions: () => {
                const base = suggestedGroups.map((g) => {
                    return new InMemoryTableAction({
                        name: g.settings.name.toString(),
                        needsSelection: true,
                        groupIndex: 0,
                        allowAutoSelectAll: false,
                        handler: async (members: PlatformRegistration[]) => {
                            await this.moveRegistrations(members, g);
                        },
                    });
                });

                if (periods.length > 1) {
                    return [
                        ...periods.map((period) => {
                            return new MenuTableAction({
                                name: period.period.name,
                                groupIndex: 1,
                                childActions: () => getForPeriod(period, false),
                            });
                        }),
                        ...base,
                    ];
                }

                return [
                    ...base,
                    ...getForPeriod(periods[0], true),
                ];
            },
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
            enabled: () => this.hasWrite,
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
            priority: 13,
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
            icon: 'file-excel',
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
            icon: 'file-pdf',
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
            icon: 'send',
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
            root: AsyncComponent(() => import('#email/EmailView.vue'), {
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
                    root: AsyncComponent(() => import('@stamhoofd/frontend-excel-export/ExcelExportView.vue'), {
                        type: ExcelExportType.Registrations,
                        filter: selection.filter,
                        workbook: getSelectableWorkbook(this.platform, this.organizations.length === 1 ? this.organizations[0] : null, this.groups, this.context.auth),
                        configurationId: 'registrations',
                        title: this.getExcelTitle(selection),
                    }),
                }),
            ],
            modalDisplayStyle: 'popup',
        });
    }

    private getExcelTitle(selection: TableActionSelection<PlatformRegistration>) {
        if (selection.markedRows && selection.markedRowsAreSelected && selection.markedRows.size === 1) {
            return [...selection.markedRows.values()][0].member.member.name;
        }
        const parts = [
            this.organizations.length === 1 && this.context.auth.hasSomePlatformAccess() ? this.organizations[0].name : null,
            this.organizations.length === 1 && this.organizations[0].period.period.id !== this.platform.period.id ? this.organizations[0].period.period.name : null,
            this.categories.length === 1
                ? this.categories[0].settings.name
                : (this.groups.length === 1 ? this.groups[0].settings.name : null),
            $t('%1EI'),
        ];

        return parts.filter(Boolean).join(' - ');
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

    private async inviteForGroup(registrations: PlatformRegistration[], group: Group, wereItemsFetched: boolean) {
        return await inviteMembersForGroup({
            members: getUniqueMembersFromRegistrations(registrations),
            group,
            context: this.context,
            owner: this.owner,
            wereItemsFetched,
        });
    }

    private async deleteInvitations(registrations: PlatformRegistration[], group: Group, wereItemsFetched: boolean) {
        await deleteInvitationsForMembers({
            members: getUniqueMembersFromRegistrations(registrations),
            group,
            context: this.context,
            owner: this.owner,
            wereItemsFetched,
        });
    }

    private async fetchEventGroupsLinkedToWaitingList(): Promise<void> {
        if (!this.isWaitingList || this.eventGroupsLinkedToWaitingList !== null) {
            return;
        }

        const waitingListId = this.groups[0].id;

        this.eventGroupsLinkedToWaitingList = await getEventGroupsLinkedToWaitingList(waitingListId);
    }

    private async getInviteMemberForGroupActionsWithGroups(): Promise<TableAction<PlatformRegistration>[]> {
        if (this.organizations.length === 0) {
            return [];
        }

        // Each entry is a period (null for waiting lists) and the category tree to invite into.
        const periodTrees: { period: OrganizationRegistrationPeriod | null; categoryTree: GroupCategoryTree }[] = [];

        if (this.isWaitingList) {
            await this.fetchEventGroupsLinkedToWaitingList();
            const tree = getCategoryTreeOfGroupsLinkedToWaitingList({ waitingList: this.groups[0], periods: this.getResolvedPeriods(this.organizations[0]) });
            if (tree) {
                periodTrees.push({ period: null, categoryTree: tree });
            }
        } else if (this.organizations.length === 1) {
            for (const period of this.getResolvedPeriods(this.organizations[0])) {
                periodTrees.push({ period, categoryTree: period.adminCategoryTree });
            }
        }

        if (periodTrees.length === 0) {
            return [];
        }

        const allGroups = periodTrees.flatMap(t => t.categoryTree.getAllGroups()).concat(this.eventGroupsLinkedToWaitingList ?? []);
        this._allGroupsLinkedToWaitingList = allGroups;

        if (allGroups.length === 0) {
            return [];
        }

        const eventGroups = this.eventGroupsLinkedToWaitingList ?? [];

        const enabled = () => this.hasWrite;

        if (this.isWaitingList && allGroups.length === 1) {
            const group = allGroups[0];

            return [
                new InMemoryTableAction({
                    name: $t('%1Qq'),
                    icon: 'success',
                    priority: 15,
                    groupIndex: 2,
                    enabled,
                    needsSelection: true,
                    allowAutoSelectAll: false,
                    // disable if already invited
                    disableIfAll: (registration: PlatformRegistration) => isMemberInvited(registration.member, group) || isMemberRegistered(registration.member, group),
                    handler: async (registrations: PlatformRegistration[], wereItemsFetched: boolean) => {
                        await this.inviteForGroup(registrations, group, wereItemsFetched);
                    },
                }),

                new InMemoryTableAction({
                    name: $t('%1Rb'),
                    icon: 'canceled',
                    priority: 14,
                    groupIndex: 2,
                    enabled,
                    needsSelection: true,
                    allowAutoSelectAll: false,
                    // disable if not invited
                    disableIfAll: (registration: PlatformRegistration) => !isMemberInvited(registration.member, group) && !isMemberRegistered(registration.member, group),
                    handler: async (registrations: PlatformRegistration[], wereItemsFetched: boolean) => {
                        await this.deleteInvitations(registrations, group, wereItemsFetched);
                    },
                }),
            ];
        }

        const getChildActions = ({ action, disableIfAll }: { action: (items: PlatformRegistration[], group: Group, wereItemsFetched: boolean) => void | Promise<void>; disableIfAll: (item: PlatformRegistration, group: Group) => boolean }) => {
            const buildForTree = (categoryTree: GroupCategoryTree) => getActionsForCategory<PlatformRegistration>(categoryTree, action, disableIfAll);

            const childActions: TableAction<PlatformRegistration>[] = [];

            if (eventGroups.length > 0) {
                childActions.push(new MenuTableAction({
                    name: $t('%uB'),
                    groupIndex: 0,
                    enabled,
                    childActions: () => eventGroups.map((g) => {
                        return new InMemoryTableAction({
                            name: g.settings.name.toString(),
                            needsSelection: true,
                            allowAutoSelectAll: false,
                            disableIfAll: item => disableIfAll(item, g),
                            handler: async (items: PlatformRegistration[], wereItemsFetched: boolean) => {
                                await action(items, g, wereItemsFetched);
                            },
                        });
                    }),
                }));
            }

            // Group by period when more than one period is available, otherwise show a flat list.
            if (periodTrees.length > 1) {
                return childActions.concat(periodTrees.map((entry) => {
                    return new MenuTableAction({
                        name: entry.period?.period.name ?? '',
                        groupIndex: 1,
                        needsSelection: true,
                        allowAutoSelectAll: false,
                        enabled,
                        childActions: () => buildForTree(entry.categoryTree),
                    });
                }));
            }

            return childActions.concat(buildForTree(periodTrees[0].categoryTree));
        };

        const actions = [
            new MenuTableAction({
                name: $t(`%1QU`),
                priority: this.isWaitingList ? 2 : 1,
                groupIndex: this.isWaitingList ? 2 : 5,
                needsSelection: true,
                allowAutoSelectAll: false,
                enabled,
                childActions: () => getChildActions({
                    // disable if already invited
                    disableIfAll: (registration: PlatformRegistration, group: Group) => isMemberInvited(registration.member, group) || isMemberRegistered(registration.member, group),
                    action: async (items, group, wereItemsFetched) => await this.inviteForGroup(items, group, wereItemsFetched),
                }),
            }),
        ];

        if (this.isWaitingList) {
            actions.push(new MenuTableAction({
                name: $t(`%1RK`),
                priority: 1,
                groupIndex: 2,
                needsSelection: true,
                allowAutoSelectAll: false,
                enabled,
                childActions: () => getChildActions({
                    // disable if not invited
                    disableIfAll: (registration: PlatformRegistration, group: Group) => !isMemberInvited(registration.member, group) && !isMemberRegistered(registration.member, group),
                    action: async (items, group, wereItemsFetched) => await this.deleteInvitations(items, group, wereItemsFetched),
                }),
            }));
        }

        return actions;
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

function getCategoryTreeOfGroupsLinkedToWaitingList({ waitingList, periods }: { waitingList: Group; periods: OrganizationRegistrationPeriod[] }): null | GroupCategoryTree {
    const isWaitingList = waitingList.type === GroupType.WaitingList;
    if (!isWaitingList) {
        return null;
    }

    const period = periods.find(p => p.period.id === waitingList.periodId);
    if (!period) {
        return null;
    }

    return period.getCategoryTree({
        admin: true,
        filterGroups: group => group.waitingList !== null && group.waitingList.id === waitingList.id,
    });
}

/**
 * Returns all event groups linked to the waiting list.
 * Does not throw if an error occurs.
 * @param waitingListId
 * @returns
 */
async function getEventGroupsLinkedToWaitingList(waitingListId: string): Promise<Group[]> {
    const request = new LimitedFilteredRequest({
        limit: 100,
        filter: {
            waitingListId,
            // only get events
            type: GroupType.EventRegistration,
        },
    });

    const groupsObjectFetcher = useGroupsObjectFetcher();

    let eventGroups: Group[] = [];
    try {
        eventGroups = await fetchAll(request, groupsObjectFetcher);
    } catch (e) {
        console.error(e);
    }

    return eventGroups;
}

async function deleteInvitationsForMembers({ members, group, context, owner, wereItemsFetched }: { members: PlatformMember[]; group: Group; context: SessionContext; owner: any; wereItemsFetched: boolean }) {
    const invitations: PatchableArrayAutoEncoder<RegistrationInvitationRequest> = new PatchableArray();

    for (const member of members) {
        for (const invitation of member.member.registrationInvitations.filter(i => i.group.id === group.id)) {
            invitations.addDelete(invitation.id);
        }
    }

    if (invitations.getDeletes().length === 0) {
        const groupName = group.settings.name.toString();
        Toast.warning(members.length === 1 ? $t('%1Qh', { group: groupName }) : $t('Deze leden zijn nog niet uitgenodigd voor {group}', { group: groupName })).show();
        return;
    }

    try {
        await context.authenticatedServer.request({
            method: 'PATCH',
            path: '/registration-invitations',
            body: invitations,
            owner,
        });

        for (const invitationId of invitations.getDeletes()) {
            for (const registrationInvitations of members.map(m => m.member.registrationInvitations)) {
                const indexOfInvitation = registrationInvitations.findIndex(i => i.id === invitationId);
                if (indexOfInvitation !== -1) {
                    registrationInvitations.splice(indexOfInvitation, 1);
                    break;
                }
            }
        }

        RegistrationInvitationEventBus.sendEvent('updated', {
            groupIds: new Set([group.id]),
            origin: wereItemsFetched ? 'members-table-async' : 'members-table-sync',
        }).catch(console.error);
    } catch (e) {
        console.error(e);
        Toast.fromError(e).show();
        return;
    }

    const successMessage = members.length === 1 ? $t('%1RC', { name: members[0].member.name }) : $t('Toelatingen voor {count} leden zijn ingetrokken', { count: members.length });
    new Toast(successMessage, 'success green').show();
}
