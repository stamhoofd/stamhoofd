import { onActivated, onBeforeUnmount, onDeactivated, onMounted } from "vue";

export function useVisibilityChange(callback: () => void | Promise<void>) {
    function onVisibilityChange() {
        if (document.visibilityState === 'visible') {
            console.log('[useVisibilityChange] visible');
            const result = callback();
            if(result instanceof Promise) {
                result.catch(console.error)
            }
        }
    }

    let listener = false;

    onMounted(() => {
        if (!listener) {
            document.addEventListener("visibilitychange", onVisibilityChange);
            listener = true;
        }
    })

    onActivated(() => {
        if (!listener) {
            document.addEventListener("visibilitychange", onVisibilityChange);
            listener = true;
        }
    })

    onDeactivated(() => {
        document.removeEventListener("visibilitychange", onVisibilityChange)
        listener = false;
    });

    onBeforeUnmount(() => {
        document.removeEventListener("visibilitychange", onVisibilityChange)
        listener = false;
    })
}
