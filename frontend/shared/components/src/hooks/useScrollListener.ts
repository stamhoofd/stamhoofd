import { onBeforeUnmount, Ref, watch } from 'vue';

export function useScrollListener(element: Ref<HTMLElement | null>, listener: () => void) {
    function handler() {
        listener();
    }

    let cleanup: null | (() => void) = null;

    const cleanWatcher = watch(element, (el) => {
        if (cleanup) {
            cleanup();
            cleanup = null;
        }
        if (el === document.documentElement) {
            window.addEventListener('scroll', handler, { passive: true });
            cleanup = () => {
                window.removeEventListener('scroll', handler);
            };
        }
        else if (el) {
            el.addEventListener('scroll', handler, { passive: true });
            cleanup = () => {
                el.removeEventListener('scroll', handler);
            };
        }
    }, { immediate: true });

    onBeforeUnmount(() => {
        if (cleanup) {
            cleanup();
            cleanup = null;
        }
        cleanWatcher();
    });
}
