import type { Decoder, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder, PatchableArray } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { ExcelExportView } from '@stamhoofd/frontend-excel-export';
import { AppManager } from '@stamhoofd/networking/AppManager';
import type { SessionContext } from '@stamhoofd/networking/SessionContext';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import type { Group, GroupCategoryTree, Organization, OrganizationRegistrationPeriod, Platform, PlatformMember } from '@stamhoofd/structures';
import { EmailRecipientFilterType, EmailRecipientSubfilter, ExcelExportType, GroupType, MemberDetails, MemberWithRegistrationsBlob, PermissionLevel, PermissionsResourceType, RegistrationInvitation, RegistrationInvitationRequest, RegistrationWithPlatformMember, mergeFilters } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { markRaw } from 'vue';
import { EditMemberAllBox, MemberSegmentedView, MemberStepView, checkoutDefaultItem, chooseOrganizationMembersForGroup } from '..';
import { GlobalEventBus } from '../../EventBus';
import { AuditLogsView } from '../../audit-logs';
import CommunicationView from '../../communication/CommunicationView.vue';
import { LoadComponent } from '../../containers/AsyncComponent';
import type { RecipientChooseOneOption } from '../../email/EmailView.vue';
import EmailView from '../../email/EmailView.vue';
import MembersPdfExportView from '../../export/MembersPdfExportView.vue';
import { useContext, useOrganization, usePlatform } from '../../hooks';
import ChargeMembersView from '../../members/ChargeMembersView.vue';
import { CenteredMessage } from '../../overlays/CenteredMessage';
import { Toast } from '../../overlays/Toast';
import type { TableAction, TableActionSelection } from '../../tables/classes';
import { AsyncTableAction, InMemoryTableAction, MenuTableAction } from '../../tables/classes';
import type { NavigationActions } from '../../types/NavigationActions';
import DeleteView from '../../views/DeleteView.vue';
import type { PlatformFamilyManager } from '../PlatformFamilyManager';
import { usePlatformFamilyManager } from '../PlatformFamilyManager';
import EditMemberResponsibilitiesBox from '../components/edit/EditMemberResponsibilitiesBox.vue';
import { RegistrationsActionBuilder } from './RegistrationsActionBuilder';
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

        return this.canWriteAllGroups();
    }

    private canWriteAllGroups() {
        for (const group of this.groups) {
            if (!this.context.auth.canAccessGroup(group, PermissionLevel.Write)) {
                return false;
            }
        }

        if (this.groups.length === 0) {
            if (STAMHOOFD.userMode === 'platform') {
                return this.context.auth.hasPlatformFullAccess() || this.context.auth.hasFullAccess();
            }

            return this.context.auth.hasFullAccess();
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
                    name: $t(`%eg`) + ' ' + org.name,
                    groupIndex: 0,
                    childActions: () => this.getRegisterActions(org),
                });
            });
        }

        const getForPeriod = (period: OrganizationRegistrationPeriod, addPeriodDescription = false) => {
            return [
                new MenuTableAction({
                    name: $t(`%eh`),
                    groupIndex: 0,
                    description: addPeriodDescription ? period.period.name : undefined,
                    enabled: period.waitingLists.length > 0,
                    childActions: () => [
                        ...period.waitingLists.map((g) => {
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
                ...getActionsForCategory<PlatformMember>(period.adminCategoryTree, async (members, group) => await this.register(members, group)).map((r) => {
                    if (addPeriodDescription) {
                        r.description = period.period.name;
                    }
                    return r;
                }),
            ];
        };

        const periods = organization.periods && this.context.auth.hasFullAccess() ? organization.periods.organizationPeriods.filter(p => !p.period.locked) : [organization.period];

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

    private getDeleteAction() {
        const enabled = STAMHOOFD.userMode === 'platform' ? (!this.context.organization && this.context.auth.hasPlatformFullAccess()) : this.context.auth.hasFullAccess();

        if (!enabled) {
            return [];
        }

        return [new InMemoryTableAction({
            name: $t('%16r'),
            destructive: true,
            priority: 1,
            groupIndex: 100,
            needsSelection: true,
            singleSelection: true,
            allowAutoSelectAll: false,
            icon: 'trash',
            enabled,
            handler: async (members: PlatformMember[]) => {
                await presentDeleteMembers({
                    members,
                    present: this.present,
                    platformFamilyManager: this.platformFamilyManager,
                });
            },
        })];
    }

    private getClearDataAction() {
        return [new InMemoryTableAction({
            name: $t('%1Ku'),
            destructive: true,
            priority: 1,
            groupIndex: 100,
            needsSelection: true,
            singleSelection: true,
            allowAutoSelectAll: false,
            icon: 'code',
            enabled: !this.context.organization && this.context.auth.hasPlatformFullAccess(),
            handler: async (members: PlatformMember[]) => {
                if (!await CenteredMessage.confirm('Alle vragenlijsten verwijderen?', 'Ja, verwijderen')) {
                    return;
                }
                const patch = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;
                for (const member of members) {
                    const p = MemberDetails.patch({});
                    for (const record of member.patchedMember.details.recordAnswers.keys()) {
                        p.recordAnswers.set(record, null);
                    }
                    patch.addPatch(MemberWithRegistrationsBlob.patch({
                        id: member.id,
                        details: p,
                    }));
                }

                await this.platformFamilyManager.isolatedPatch(members, patch);

                Toast.success($t('%1Kv')).show();
                return;
            },
        })];
    }

    getMoveAction(selectedOrganizationRegistrationPeriod?: OrganizationRegistrationPeriod): TableAction<PlatformMember>[] {
        if (this.organizations.length !== 1) {
            return [];
        }

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

        const organization = this.organizations[0];
        const periods = organization.periods && this.context.auth.hasFullAccess() ? organization.periods.organizationPeriods.filter(p => !p.period.locked) : [selectedOrganizationRegistrationPeriod ?? organization.period];

        const getForPeriod = (period: OrganizationRegistrationPeriod, addPeriodDescription = false) => {
            return [
                new MenuTableAction({
                    name: $t(`%eh`),
                    groupIndex: 1,
                    enabled: period.waitingLists.length > 0,
                    description: addPeriodDescription ? period.period.name : undefined,
                    childActions: () => [
                        ...period.waitingLists.map((g) => {
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
                    if (addPeriodDescription) {
                        r.description = period.period.name;
                    }
                    return r;
                }),
            ];
        };

        return [
            new MenuTableAction({
                name: $t(`%HB`),
                priority: 1,
                groupIndex: 5,
                needsSelection: true,
                allowAutoSelectAll: false,
                enabled: this.hasWrite,
                childActions: () => {
                    const base = suggestedGroups.map((g) => {
                        return new InMemoryTableAction({
                            name: g.settings.name.toString(),
                            needsSelection: true,
                            groupIndex: 0,
                            allowAutoSelectAll: false,
                            handler: async (members: PlatformMember[]) => {
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

        return [
            new InMemoryTableAction({
                name: $t(`%1KS`),
                priority: 1,
                groupIndex: 7,
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (members: PlatformMember[]) => {
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

    getShowMessagesAction(): TableAction<PlatformMember>[] {
        if (!this.context.auth.hasAccessForSomeResourceOfType(PermissionsResourceType.Senders, PermissionLevel.Read)) {
            return [];
        }

        return [
            new InMemoryTableAction({
                name: $t(`%1GU`),
                priority: 1,
                groupIndex: 7,
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (members: PlatformMember[]) => {
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

    getEditAction(): TableAction<PlatformMember>[] {
        if (this.organizations.length !== 1 || this.groups.length === 0) {
            return [];
        }

        return [
            new InMemoryTableAction({
                name: $t(`%zt`),
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
            name: $t(`%zu`),
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

    getChargeAction() {
        return new AsyncTableAction({
            name: $t(`%Gu`),
            icon: 'calculator',
            priority: 13,
            groupIndex: 4,
            handler: async (selection: TableActionSelection<PlatformMember>) => {
                await this.present({
                    modalDisplayStyle: 'popup',
                    components: [
                        new ComponentWithProperties(ChargeMembersView, {
                            filter: selection.filter.filter,
                        }),
                    ],
                });
            },
        });
    }

    editResponsibilities(member: PlatformMember) {
        presentEditResponsibilities({ member, present: this.present }).catch(console.error);
    }

    editMember(member: PlatformMember) {
        presentEditMember({ member, present: this.present, context: this.context }).catch(console.error);
    }

    getActions(options: { includeMove?: boolean; includeEdit?: boolean; includeOnlyIfRelevantForWaitingList?: boolean; selectedOrganizationRegistrationPeriod?: OrganizationRegistrationPeriod } = {}): TableAction<PlatformMember>[] {
        const allActions: TableAction<PlatformMember>[] = [];

        const includeOnlyRelevantForWaitingList = options.includeOnlyIfRelevantForWaitingList && this.groups.length === 1 && this.groups[0].type === GroupType.WaitingList;

        allActions.push(new InMemoryTableAction({
            name: $t(`%XO`),
            icon: 'edit',
            priority: 2,
            groupIndex: 1,
            needsSelection: true,
            singleSelection: true,
            enabled: this.hasWrite,
            handler: (members: PlatformMember[]) => {
                this.editMember(members[0]);
            },
        }));
        
        if (!includeOnlyRelevantForWaitingList) {
            allActions.push(new InMemoryTableAction({
                name: $t(`%ej`),
                icon: 'star',
                priority: 0,
                groupIndex: 1,
                needsSelection: true,
                singleSelection: true,
                enabled: this.context.auth.hasFullAccess(),
                handler: (members: PlatformMember[]) => {
                    this.editResponsibilities(members[0]);
                },
            }));
        }

        allActions.push(new AsyncTableAction({
            name: $t(`%1GW`),
            icon: 'email',
            priority: 12,
            groupIndex: 3,
            handler: async (selection: TableActionSelection<PlatformMember>) => {
                await this.openMail(selection);
            },
        }));

        allActions.push(this.getSmsAction());
        allActions.push(this.getExportAction());

        allActions.push(new MenuTableAction({
            name: $t(`%dh`),
            priority: 1,
            groupIndex: 5,
            needsSelection: true,
            allowAutoSelectAll: false,
            enabled: this.hasWrite && !!this.context.organization,
            childActions: () => this.getRegisterActions(),
        }));

        if (options.includeMove) {
            allActions.push(...this.getMoveAction(options.selectedOrganizationRegistrationPeriod));
        }

        if (options.includeEdit) {
            allActions.push(...this.getEditAction());
        }

        if (STAMHOOFD.environment === 'development') {
            allActions.push(...this.getClearDataAction());
        }

        allActions.push(...this.getInviteMemberForGroupActions());
        allActions.push(...this.getDeleteAction());
        allActions.push(...this.getUnsubscribeAction());
        allActions.push(...this.getAuditLogAction());
        allActions.push(...this.getShowMessagesAction());

        return allActions;
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

    private getInviteMemberForGroupActions(): TableAction<PlatformMember>[] {
        const result = this.getCategoryTreeOfGroupsLinkedToWaitingList();

        if (!result) {
            return [];
        }

        const {categoryTree, waitingList} = result;

        const enabled = this.hasWrite;

        const allGroups = categoryTree.getAllGroups();
        if (allGroups.length === 0) {
            return [];
        }
        
        if (allGroups.length === 1) {
            const group = allGroups[0];
            return [
                new InMemoryTableAction({
                    name: $t('Toelaten om in te schrijven'),
                    icon: 'success',
                    priority: 15,
                    groupIndex: 2,
                    enabled,
                    needsSelection: true,
                    allowAutoSelectAll: false,
                    handler: async (members: PlatformMember[]) => {
                        await this.inviteForGroup(members, group)
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
                    handler: async (members: PlatformMember[]) => {
                        await this.deleteInvitations(members, group)
                    }
                }),
            ]
        }

        return [
            new MenuTableAction({
                name: $t(`Inschrijven toelaten voor`),
                priority: 2,
                groupIndex: 2,
                needsSelection: true,
                allowAutoSelectAll: false,
                enabled,
                childActions: () => getActionsForCategory<PlatformMember>(categoryTree, async (members, group) => await this.inviteForGroup(members, group))
            })];
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
            handler: async (members: PlatformMember[]) => {
                await this.openSms(members);
            },
        });
    }

    private async openSms(members: PlatformMember[]) {
        const displayedComponent = await LoadComponent(() => import(/* webpackChunkName: "SMSView" */ '#views/SMSView.vue'), {
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
                    name: $t(`%L8`),
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
                    name: $t(`%el`),
                    value: [],
                },
                {
                    id: 'adults',
                    name: $t(`%em`),
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
                    name: $t(`%en`),
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
                    name: $t(`%eo`),
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
                    name: $t(`%es`),
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
            name: $t('%17V'),
            priority: 0,
            groupIndex: 0,
            fetchLimitSettings: { limit: 500, createErrorMessage: (count, limit) => {
                return $t('%17W', { count: Formatter.float(count), limit: Formatter.float(limit) });
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

    private async inviteForGroup(members: PlatformMember[], group: Group) {
        if (members.length === 0) {
            return;
        }

        const invitations: PatchableArrayAutoEncoder<RegistrationInvitationRequest> = new PatchableArray();
        for (const member of members) {
            const invitation = RegistrationInvitationRequest.create({
                groupId: group.id,
                memberId: member.member.id,
            })

            invitations.addPut(invitation);
        }

        try {
            const response = await this.context.authenticatedServer.request({
                method: 'PATCH',
                path: '/registration-invitations',
                body: invitations,
                owner: this.owner,
                decoder: new ArrayDecoder(RegistrationInvitation as Decoder<RegistrationInvitation>)
            });

            const responseInvitations: RegistrationInvitation[] = response.data;

            // update invitations
            for (const invitation of responseInvitations) {
                const member = members.find(m => m.member.id === invitation.member.id);
                if (member && !member.member.registrationInvitations.find(i => i.id === invitation.id)) {
                    member.member.registrationInvitations.push(invitation);
                }
            }
        } catch (e) {
            console.error(e);
            Toast.fromError(e).show();
            return;
        }

        const successMessage = members.length === 1 ? $t('{name} is uitgenodigd', { name: members[0].member.name }) : $t('{count} leden zijn uitgenodigd', { count: members.length });
        new Toast(successMessage, 'success green').show();
    }

    private async deleteInvitations(members: PlatformMember[], group: Group) {
        const invitations: PatchableArrayAutoEncoder<RegistrationInvitationRequest> = new PatchableArray();

        for (const member of members) {
            for (const invitation of member.member.registrationInvitations.filter(i => i.groupId === group.id)) {
                invitations.addDelete(invitation.id);
            }
        }

        if (invitations.getDeletes().length === 0) {
            new Toast(members.length === 1 ? $t('Dit lid is nog niet toegestaan') : $t('Deze leden zijn nog niet toegestaan'), 'info').show();
            return;
        }

        try {
            await this.context.authenticatedServer.request({
                method: 'PATCH',
                path: '/registration-invitations',
                body: invitations,
                owner: this.owner
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
        } catch (e) {
            console.error(e);
            Toast.fromError(e).show();
            return;
        }

        const successMessage = members.length === 1 ? $t('Uitnodiging voor {name} is ingetrokken', { name: members[0].member.name }) : $t('Uitnodiging voor {count} leden zijn ingetrokken', { count: members.length });
        new Toast(successMessage, 'success green').show();
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

export async function presentEditMember({ member, present, context }: { member: PlatformMember; present: ReturnType<typeof usePresent>; context: SessionContext }) {
    await present({
        components: [
            new ComponentWithProperties(MemberStepView, {
                member,
                title: $t(`%15E`, { firstName: member.member.firstName }),
                component: markRaw(EditMemberAllBox),
                saveHandler: async ({ dismiss }: NavigationActions) => {
                    await dismiss({ force: true });

                    // Mark review moment
                    AppManager.shared.markReviewMoment(context);
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
                title: $t(`%et`) + ' ' + member.member.firstName,
                component: markRaw(EditMemberResponsibilitiesBox),
                saveHandler: async ({ dismiss }: NavigationActions) => {
                    await dismiss({ force: true });
                    GlobalEventBus.sendEvent('members-responsibilities-changed', [member]).catch(console.error);
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
            message: $t('%ef'),
        });
    }

    const member = members[0].patchedMember;
    const name = member.name;

    await present({
        components: [
            new ComponentWithProperties(DeleteView, {
                title: $t('%15Y', { name }),
                description: $t(`%15X`, { name }),
                confirmationTitle: $t(`%eu`),
                confirmationPlaceholder: $t(`%10H`),
                confirmationCode: name,
                checkboxText: $t(`%6P`),
                onDelete: async () => {
                    const patch = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;
                    for (const member of members) {
                        patch.addDelete(member.id);
                    }

                    await platformFamilyManager.isolatedPatch(members, patch);
                    GlobalEventBus.sendEvent('members-deleted', members).catch(console.error);

                    Toast.success(
                        members.length ? $t('%14q') : $t('%14r', { count: members.length }),
                    ).show();
                    return true;
                },
            }),
        ],
        modalDisplayStyle: 'sheet',
    });
}

export async function presentExportMembersToPdf({ members, platform, organizations, groups, present }: { members: PlatformMember[]; platform: Platform; organizations: Organization[]; groups: Group[]; present: ReturnType<typeof usePresent> }) {
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(MembersPdfExportView, {
                    platform,
                    organization: organizations.length === 1 ? organizations[0] : null,
                    groups,
                    configurationId: 'members',
                    items: members,
                }),
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}
