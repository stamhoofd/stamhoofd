import { onBeforeUnmount } from "vue";

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

    document.addEventListener("visibilitychange", onVisibilityChange);

    onBeforeUnmount(() => {
        document.removeEventListener("visibilitychange", onVisibilityChange)
    })
}
