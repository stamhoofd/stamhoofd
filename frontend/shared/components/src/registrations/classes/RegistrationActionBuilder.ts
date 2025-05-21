import { usePresent } from '@simonbackx/vue-app-navigation';
import { SessionContext } from '@stamhoofd/networking';
import { Group, PermissionLevel, PlatformRegistration } from '@stamhoofd/structures';
import { useContext } from '../../hooks';
import { presentEditMember, presentEditResponsibilities } from '../../members';
import { InMemoryTableAction, MenuTableAction } from '../../tables';

export function useDirectRegistrationActions(options?: { groups?: Group[];
}) {
    return useRegistrationActions()(options);
}

export function useRegistrationActions() {
    const present = usePresent();
    const context = useContext();

    return (options?: { groups?: Group[];
        forceWriteAccess?: boolean | null; }) => {
        return new RegistrationActionBuilder({
            present,
            context: context.value,
            groups: options?.groups ?? [],
            forceWriteAccess: options?.forceWriteAccess,
        });
    };
}

export class RegistrationActionBuilder {
    private groups: Group[];
    private context: SessionContext;
    private forceWriteAccess: boolean | null = null;
    private present: ReturnType<typeof usePresent>;

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
    }) {
        this.present = settings.present;
        this.context = settings.context;
        this.groups = settings.groups;
        this.forceWriteAccess = settings.forceWriteAccess ?? null;
    }

    getActions() {
        const actions = [
            new MenuTableAction({
                name: $t('Lid'),
                groupIndex: 0,
                singleSelection: true,
                enabled: this.hasWrite,
                needsSelection: true,
                allowAutoSelectAll: false,
                childActions: () => this.getMemberActions(),
            }),

        ];

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
}
