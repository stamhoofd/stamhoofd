import { usePresent } from '@simonbackx/vue-app-navigation';
import { SessionContext, useRequestOwner } from '@stamhoofd/networking';
import { Group, GroupCategoryTree, Organization, OrganizationRegistrationPeriod, PermissionLevel, PlatformMember, RegisterCheckout, RegisterItem, Registration, RegistrationWithPlatformMember } from '@stamhoofd/structures';
import { checkoutRegisterItem, chooseOrganizationMembersForGroup } from '..';
import { useContext, useOrganization } from '../../hooks';
import { InMemoryTableAction, MenuTableAction, TableAction } from '../../tables/classes';
import { PlatformFamilyManager, usePlatformFamilyManager } from '../PlatformFamilyManager';

export function useRegistrationActionBuilder() {
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

        return new RegistrationActionBuilder({
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

export class RegistrationActionBuilder {
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
        const period = selectedOrganizationRegistrationPeriod ?? this.organization.period;

        return [
            new MenuTableAction({
                name: $t(`9d928561-b64b-46c2-a2c9-c6997384a451`),
                priority: 1,
                groupIndex: 5,
                needsSelection: true,
                allowAutoSelectAll: false,
                enabled: this.hasWrite,
                childActions: () => [
                    new MenuTableAction({
                        name: $t(`72aa2f8d-23dc-4056-98af-a7fc32c9c0ef`),
                        groupIndex: 0,
                        enabled: this.organization.period.waitingLists.length > 0,
                        childActions: () => [
                            ...this.organization.period.waitingLists.map((g) => {
                                return new InMemoryTableAction({
                                    name: g.settings.name.toString(),
                                    needsSelection: true,
                                    allowAutoSelectAll: false,
                                    handler: async () => {
                                        await this.moveRegistrations(g);
                                    },
                                });
                            }),
                        ],
                    }),
                    ...this.getActionsForCategory(period.adminCategoryTree, group => this.moveRegistrations(group)).map((r) => {
                        r.description = period.period.name;
                        return r;
                    }),
                ],
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
                    const href = '/beheerders/' + organization.uri;
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
