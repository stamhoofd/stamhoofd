import { onBeforeUnmount } from "vue";

export function useVisibilityChange(callback: () => void) {
    function onVisibilityChange() {
        if (document.visibilityState === 'visible') {
            console.log('[useVisibilityChange] visible');
            callback();
        }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    onBeforeUnmount(() => {
        document.removeEventListener("visibilitychange", onVisibilityChange)
    })
}
