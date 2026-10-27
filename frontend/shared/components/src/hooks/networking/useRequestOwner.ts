import { Request } from '@common/networking';
import { GlobalEventBus } from '@stamhoofd/frontend-application/EventBus.ts';
import { markRaw, onBeforeUnmount, onDeactivated } from 'vue';

/**
 * Create/reuse a raw request owner during component setup. Before unmount, cancel
 * its requests/retries and remove its GlobalEventBus listeners. Keep-alive
 * deactivation does this only when cancelOnDeactivated is true (default false).
 */
export function useRequestOwner(custom: any = undefined, options?: {cancelOnDeactivated?: boolean}): object {
    const owner = markRaw(custom === undefined ? {} : custom);

    onBeforeUnmount(() => {
        Request.cancelAll(owner);
        GlobalEventBus.removeListener(owner);
    });

    if (options?.cancelOnDeactivated) {
        onDeactivated(() => {
            Request.cancelAll(owner);
            GlobalEventBus.removeListener(owner);
        })
    }

    return owner;
}
