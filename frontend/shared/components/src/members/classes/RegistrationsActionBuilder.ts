import { usePresent } from '@simonbackx/vue-app-navigation';
import { SessionContext, useRequestOwner } from '@stamhoofd/networking';
import { appToUri, Group, GroupCategoryTree, Organization, OrganizationRegistrationPeriod, PermissionLevel, PlatformMember, RegisterCheckout, RegisterItem, Registration, RegistrationWithPlatformMember } from '@stamhoofd/structures';
import { checkoutRegisterItem, chooseOrganizationMembersForGroup } from '..';
import { useContext, useOrganization } from '../../hooks';
import { InMemoryTableAction, MenuTableAction, TableAction } from '../../tables/classes';
import { PlatformFamilyManager, usePlatformFamilyManager } from '../PlatformFamilyManager';

export function useRegistrationsActionBuilder() {
    const present = usePresent();
    const context = useContext();
    const platformFamilyManager = usePlatformFamilyManager();
    const owner = useRequestOwner();
    const organization = useOrganization();

    return (options: { registration: Registration; member: PlatformMember }) => {
        const org = options.member.organizations.find(o => o.id === options.registration.organizationId) ?? organization.value;

        if (!org) {
            throw new Error('Organization not found for registration');
        }

        return new RegistrationsActionBuilder({
            present,
            context: context.value,
            members: [options.member],
            organization: org,
            registrations: [options.registration],
            platformFamilyManager,
            owner,
        });
    };
}

export class RegistrationsActionBuilder {
    /**
     * Determines which registrations will get moved or removed
     */
    registrations: Registration[];
    members: PlatformMember[];
    organization: Organization;
    present: ReturnType<typeof usePresent>;
    context: SessionContext;
    platformFamilyManager: PlatformFamilyManager;
    owner: any;

    constructor(settings: {
        present: ReturnType<typeof usePresent>;
        context: SessionContext;
        registrations: Registration[];
        members: PlatformMember[];
        organization: Organization;
        platformFamilyManager: PlatformFamilyManager;
        owner: any;
    }) {
        this.present = settings.present;
        this.context = settings.context;
        this.registrations = settings.registrations;
        this.members = settings.members;
        this.organization = settings.organization;
        this.platformFamilyManager = settings.platformFamilyManager;
        this.owner = settings.owner;
    }

    get hasWrite() {
        for (const registration of this.registrations) {
            if (!this.context.auth.canAccessRegistration(registration, this.organization, PermissionLevel.Write)) {
                return false;
            }
        }
        return true;
    }

    getMoveAction(selectedOrganizationRegistrationPeriod?: OrganizationRegistrationPeriod): TableAction<PlatformMember>[] {
        const suggestedGroups: Group[] = [];

        for (const r of this.registrations) {
            const add = [r.group?.waitingList];
            for (const a of add) {
                if (a) {
                    if (suggestedGroups.find(gg => gg.id === a.id)) {
                        continue; // Already suggested
                    }
                    suggestedGroups.push(a);
                }
            }
        }

        const organization = this.organization;
        const periods = organization.periods && this.context.auth.hasFullAccess() ? organization.periods.organizationPeriods.filter(p => !p.period.locked) : [selectedOrganizationRegistrationPeriod ?? organization.period];

        const getForPeriod = (period: OrganizationRegistrationPeriod, addPeriodDescription = false) => {
            return [
                new MenuTableAction({
                    name: $t(`93d604bc-fddf-434d-a993-e6e456d32231`),
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
                                    await this.moveRegistrations(g);
                                },
                            });
                        }),
                    ],
                }),
                ...this.getActionsForCategory(period.adminCategoryTree, group => this.moveRegistrations(group)).map((r) => {
                    if (addPeriodDescription) {
                        r.description = period.period.name;
                    }
                    return r;
                }),
            ];
        };

        return [
            new MenuTableAction({
                name: $t(`507c48cb-35ae-4c94-bc7a-4611360409c8`),
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
                                await this.moveRegistrations(g);
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

    getEditAction(): TableAction<PlatformMember>[] {
        return [
            new InMemoryTableAction({
                name: $t(`7c6e4f2d-297d-4183-9079-ba123f481eb5`),
                priority: 1,
                groupIndex: 1,
                needsSelection: true,
                allowAutoSelectAll: false,
                enabled: this.hasWrite,
                handler: async () => {
                    await this.editRegistrations();
                },
                icon: 'edit',
            }),
        ];
    }

    getUnsubscribeAction(): TableAction<PlatformMember>[] {
        return [new InMemoryTableAction({
            name: $t(`5ac7a958-ec4d-4e37-b2c0-35b2ada59044`),
            destructive: true,
            priority: 0,
            groupIndex: 7,
            needsSelection: true,
            allowAutoSelectAll: false,
            enabled: this.hasWrite,
            handler: async () => {
                await this.deleteRegistration();
            },
        })];
    }

    getActionsForCategory(category: GroupCategoryTree, action: (group: Group) => void | Promise<void>): TableAction<PlatformMember>[] {
        return [
            ...category.categories.map((c) => {
                return new MenuTableAction({
                    name: c.settings.name,
                    groupIndex: 2,
                    needsSelection: true,
                    allowAutoSelectAll: false,
                    enabled: c.groups.length > 0 || c.categories.length > 0,
                    childActions: () => this.getActionsForCategory(c, action),
                });
            }),
            ...category.groups.map((g) => {
                return new InMemoryTableAction({
                    name: g.settings.name.toString(),
                    needsSelection: true,
                    allowAutoSelectAll: false,
                    handler: async () => {
                        await action(g);
                    },
                });
            }),
        ];
    }

    getAdminActions(): TableAction<PlatformMember>[] {
        if (this.registrations.length !== 1) {
            return [];
        }
        const organizationId = this.registrations[0].organizationId;
        if (this.context.organization?.id === organizationId) {
            return [];
        }

        if (this.context.auth.platformPermissions === null) {
            return [];
        }

        const memberId = this.registrations[0].memberId;
        const registration = this.registrations[0];
        const member = this.members.find(m => m.id === memberId);
        if (!member) {
            return [];
        }
        const organization = member.organizations.find(o => o.id === registration.organizationId);
        if (!organization) {
            return [];
        }

        // Add quick switch action
        return [
            new InMemoryTableAction({
                name: $t(`25faeb66-9c64-4431-85de-cef9edfac517`),
                description: organization.name,
                priority: 0,
                groupIndex: 5,
                needsSelection: true,
                allowAutoSelectAll: false,
                icon: 'external',
                enabled: this.hasWrite,
                handler: async () => {
                    const href = '/' + appToUri('dashboard') + (STAMHOOFD.singleOrganization ? '' : ('/' + organization.uri));
                    window.open(href, '_blank');
                },
            }),
        ];
    }

    getActions(options: { selectedOrganizationRegistrationPeriod?: OrganizationRegistrationPeriod } = {}): TableAction<PlatformMember>[] {
        return [
            ...this.getMoveAction(options.selectedOrganizationRegistrationPeriod),
            ...this.getAdminActions(),
            ...this.getEditAction(),
            ...this.getUnsubscribeAction(),
        ];
    }

    async deleteRegistration() {
        const deleteRegistrations: RegistrationWithPlatformMember[] = [];

        for (const registration of this.registrations) {
            const member = this.members.find(m => m.id === registration.memberId);
            if (!member) {
                console.warn('Member not found for registration in RegistrationActionBuilder.moveRegistrations', registration);
                continue;
            }

            deleteRegistrations.push(new RegistrationWithPlatformMember({ registration, member }));
        }

        return await chooseOrganizationMembersForGroup({
            organization: this.organization,
            context: this.context,
            owner: this.owner,
            deleteRegistrations,
            members: this.members,
            items: [],
            navigate: {
                present: this.present,
                show: this.present,
                pop: () => Promise.resolve(),
                dismiss: () => Promise.resolve(),
            },
        });
    }

    async moveRegistrations(group: Group) {
        const items: RegisterItem[] = [];
        const checkout = new RegisterCheckout();
        checkout.setDefaultOrganization(this.organization);

        for (const registration of this.registrations) {
            const member = this.members.find(m => m.id === registration.memberId);
            if (!member) {
                console.warn('Member not found for registration in RegistrationActionBuilder.moveRegistrations', registration);
                continue;
            }

            member.family.checkout = checkout;
            member.family.pendingRegisterItems = [];

            const item = registration.group.id === group.id ? RegisterItem.fromRegistration(registration, member, this.organization) : RegisterItem.defaultFor(member, group, this.organization);
            item.replaceRegistrations = [
                new RegistrationWithPlatformMember({
                    registration,
                    member,
                }),
            ];
            items.push(item);
        }

        if (items.length === 1) {
            return await checkoutRegisterItem({
                item: items[0],
                admin: true,
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
            group,
            context: this.context,
            owner: this.owner,
            items,
            navigate: {
                present: this.present,
                show: this.present,
                pop: () => Promise.resolve(),
                dismiss: () => Promise.resolve(),
            },
        });
    }

    async editRegistrations() {
        const items: RegisterItem[] = [];
        const groupOrganization = this.organization;
        const checkout = new RegisterCheckout();
        checkout.setDefaultOrganization(groupOrganization);

        for (const registration of this.registrations) {
            const member = this.members.find(m => m.id === registration.memberId);
            if (!member) {
                console.warn('Member not found for registration in RegistrationActionBuilder.editRegistrations', registration);
                continue;
            }
            member.family.checkout = checkout;
            member.family.pendingRegisterItems = [];

            const item = RegisterItem.fromRegistration(registration, member, groupOrganization);
            item.replaceRegistrations = [
                new RegistrationWithPlatformMember({
                    registration,
                    member,
                }),
            ];
            items.push(item);
        }

        if (items.length === 1) {
            return await checkoutRegisterItem({
                item: items[0],
                admin: true,
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
            organization: groupOrganization,
            context: this.context,
            owner: this.owner,
            items,
            navigate: {
                present: this.present,
                show: this.present,
                pop: () => Promise.resolve(),
                dismiss: () => Promise.resolve(),
            },
        });
    }
}
