import { onMounted, onUnmounted } from 'vue';
import { EventBus } from '../../EventBus';

type RegistrationInvitationEventName = 'updated';
type RegistrationInvitationEventNameValue = {groupIds: Set<string>}

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
