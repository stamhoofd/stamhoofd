import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { useRequestOwner } from '@stamhoofd/networking';
import type { SessionContext } from '@stamhoofd/networking/SessionContext';
import type { Group, RegistrationInvitation, RegistrationInvitationRequest } from '@stamhoofd/structures';
import { PermissionLevel } from '@stamhoofd/structures';
import { useContext } from '../../hooks';
import { CenteredMessage } from '../../overlays/CenteredMessage';
import { Toast } from '../../overlays/Toast';
import type { TableAction } from '../../tables';
import { InMemoryTableAction } from '../../tables';
import { RegistrationInvitationEventBus } from './useRegistrationInvitationEventListener';

export function useRegistrationInvitationActionBuilder() {
    const context = useContext();
    const owner = useRequestOwner();

    return (options: {group: Group}) => {
        return new RegistrationInvitationActionBuilder({
            ...options,
            context: context.value,
            owner,
        });
    }
}

export class RegistrationInvitationActionBuilder {
    private readonly group: Group;
    private readonly context: SessionContext;
    private readonly owner: any;

    get hasWrite() {
        return this.context.auth.canAccessGroup(this.group, PermissionLevel.Write)
    }

    constructor(settings: {
        group: Group;
        context: SessionContext;
        owner: any;
    }) {
        this.group = settings.group;
        this.context = settings.context;
        this.owner = settings.owner;
    }

    getActions() {
        const actions: TableAction<RegistrationInvitation>[] = [];

        const deleteAction = this.getDeleteAction();
        if (deleteAction) {
            actions.push(deleteAction);
        }

        return actions;
    }

    private getDeleteAction(): TableAction<RegistrationInvitation> | null {
        if (!this.hasWrite) {
            return null;
        }
        
        return new InMemoryTableAction({
            name: $t('Verwijder'),
            destructive: true,
            priority: 1,
            groupIndex: 100,
            needsSelection: true,
            allowAutoSelectAll: false,
            icon: 'trash',
            enabled: true,
            handler: async (invitations: RegistrationInvitation[]) => {
                const message = invitations.length === 1 ? $t('Weet je zeker dat je de uitnodiging van {name} wilt verwijderen?', {name: invitations[0].member.name}) : $t('Weet je zeker dat je {count} uitnodigingen wilt verwijderen?', {count: invitations.length});
                const isConfirm = await CenteredMessage.confirm(message, $t('Verwijder'));

                if (isConfirm) {
                    // todo
                    this.deleteInvitations(invitations).catch(console.error);
                }
            },
        });
    }

    private async deleteInvitations(invitations: RegistrationInvitation[]) {
        const patchableArray: PatchableArrayAutoEncoder<RegistrationInvitationRequest> = new PatchableArray();
        invitations.forEach(i => patchableArray.addDelete(i.id));
    
        try {
            await this.context.authenticatedServer.request({
                method: 'PATCH',
                path: '/registration-invitations',
                body: patchableArray,
                owner: this.owner
            });

            RegistrationInvitationEventBus.sendEvent('updated', {groupIds: new Set(invitations.map(i => i.group.id))}).catch(console.error);
        } catch (e) {
            console.error(e);
            Toast.fromError(e).show();
            return;
        }
    
        const successMessage = invitations.length === 1 ? $t('De uitnodiging is verwijderd') : $t('{count} uitnodigingen zijn verwijderd', { count: invitations.length });
        new Toast(successMessage, 'success green').show();
    }
}
