import { onMounted, onUnmounted } from 'vue';
import { EventBus } from '../../EventBus';

type RegistrationInvitationEventName = 'updated';

// makes it possible for the listener to decide to do something depending on the origin
export type RegistrationInvitationEvenOrigin = 'invitations-table' | 'members-table-sync' | 'members-table-async';
type RegistrationInvitationEventNameValue = {groupIds: Set<string>, origin?: RegistrationInvitationEvenOrigin}

export const RegistrationInvitationEventBus = new EventBus<RegistrationInvitationEventName, RegistrationInvitationEventNameValue>();

export function useRegistrationInvitationEventListener(eventName: RegistrationInvitationEventName,  handler: (value: RegistrationInvitationEventNameValue) => Promise<void> | void) {
    const owner = {};
    
    onMounted(() => {
        RegistrationInvitationEventBus.addListener(owner, eventName, handler);
    });

    onUnmounted(() => {
        RegistrationInvitationEventBus.removeListener(owner);
    });
}
