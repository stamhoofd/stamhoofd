import { Request } from '@simonbackx/simple-networking';
import { GlobalEventBus } from '@stamhoofd/components';
import { markRaw, onBeforeUnmount } from 'vue';

export function useRequestOwner(custom: any = undefined): object {
    const owner = markRaw(custom === undefined ? {} : custom);

    onBeforeUnmount(() => {
        Request.cancelAll(owner);
        GlobalEventBus.removeListener(owner);
    });

    return owner;
}
