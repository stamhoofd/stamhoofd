import { onMounted, onUnmounted } from "vue";
import { GlobalEventBus } from "../EventBus";

export function useGlobalEventListener<Value>(eventName: string, handler: (value: Value) => Promise<void>) {
    const owner = {};

    onMounted(() => {
        GlobalEventBus.addListener(owner, eventName, handler);
    });

    onUnmounted(() => {
        GlobalEventBus.removeListener(owner);
    });
}
