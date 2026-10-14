import { Request } from '@simonbackx/simple-networking';
import { GlobalEventBus } from '#EventBus.ts';
import { markRaw, onBeforeUnmount, onDeactivated } from 'vue';

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
