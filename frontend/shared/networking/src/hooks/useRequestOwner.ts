import { Request } from '@simonbackx/simple-networking';
import { GlobalEventBus } from '@stamhoofd/components';
import { markRaw, onBeforeUnmount } from 'vue';

export function useRequestOwner(): object {
    const owner = markRaw({});

    onBeforeUnmount(() => {
        Request.cancelAll(owner);
        GlobalEventBus.removeListener(owner);
    });

    return owner;
}
