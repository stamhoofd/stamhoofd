import { usePresent } from '@simonbackx/vue-app-navigation';
import { SessionContext, useRequestOwner } from '@stamhoofd/networking';
import { Group, PermissionLevel, PlatformMember, PlatformRegistration, RegistrationWithPlatformMember } from '@stamhoofd/structures';
import { useContext } from '../../hooks';
import { chooseOrganizationMembersForGroup, presentEditMember, presentEditResponsibilities } from '../../members';
import { InMemoryTableAction, MenuTableAction, TableAction } from '../../tables';

export function useDirectRegistrationActions(options?: { groups?: Group[];
}) {
    return useRegistrationActions()(options);
}

export function useRegistrationActions() {
    const present = usePresent();
    const context = useContext();
    const owner = useRequestOwner();

    return (options?: { groups?: Group[];
        forceWriteAccess?: boolean | null; }) => {
        return new RegistrationActionBuilder({
            present,
            context: context.value,
            groups: options?.groups ?? [],
            forceWriteAccess: options?.forceWriteAccess,
            owner,
        });
    };
}

export class RegistrationActionBuilder {
    private groups: Group[];
    private context: SessionContext;
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
        forceWriteAccess?: boolean | null;
        owner: any;
    }) {
        this.present = settings.present;
        this.context = settings.context;
        this.groups = settings.groups;
        this.owner = settings.owner;
        this.forceWriteAccess = settings.forceWriteAccess ?? null;
    }

    getActions() {
        const actions: TableAction<PlatformRegistration>[] = [
            new MenuTableAction({
                name: $t('Lid'),
                groupIndex: 0,
                singleSelection: true,
                enabled: this.hasWrite,
                needsSelection: true,
                allowAutoSelectAll: false,
                childActions: () => this.getMemberActions(),
            }),
            this.getUnsubscribeAction(),
        ].filter(a => a !== null);

        return actions;
    }

    private getMemberActions() {
        const actions = [
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
        ];

        return actions;
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
}

function getUniqueMembersFromRegistrations(registrations: PlatformRegistration[]): PlatformMember[] {
    const allMembers = registrations.map(r => r.member);
    const uniqueMemberIds = new Set(allMembers.map(m => m.id));
    return [...uniqueMemberIds].map(id => allMembers.find(m => m.id === id)!);
}
