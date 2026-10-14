import { onMounted, onUnmounted } from 'vue';
import { GlobalEventBus } from '@stamhoofd/networking/EventBus';

export function useGlobalEventListener<Value>(eventName: string | symbol, handler: (value: Value) => Promise<void> | void) {
    const owner = {};

    onMounted(() => {
        GlobalEventBus.addListener(owner, eventName, handler);
    });

    onUnmounted(() => {
        GlobalEventBus.removeListener(owner);
    });
}
