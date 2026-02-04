import { onBeforeUnmount, Ref, watch } from 'vue';

export function useResizeObserver(elementRef: Ref<HTMLElement | HTMLElement[] | null>, callback: () => void) {
    const observing = new Set<HTMLElement>();
    const observer = new ResizeObserver((entries) => {
        callback();
    });

    function observe(el: HTMLElement) {
        if (observing.has(el)) {
            return;
        }
        observer.observe(el);
        observing.add(el);
    }

    function unobserveAll() {
        for (const el of observing) {
            observer.unobserve(el);
        }
        observing.clear();
    }

    const cleanWatcher = watch(elementRef, (el) => {
        unobserveAll();
        if (el) {
            if (Array.isArray(el)) {
                for (const e of el) {
                    observe(e);
                }
            }
            else {
                observe(el);
            }
        }
    }, { deep: true });

    onBeforeUnmount(() => {
        cleanWatcher();
        observer.disconnect();
    });
}
