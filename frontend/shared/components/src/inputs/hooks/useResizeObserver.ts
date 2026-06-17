import type { Ref } from 'vue';
import { onBeforeUnmount, watch } from 'vue';

export function useResizeObserver(elementRef: Ref<HTMLElement | null>, callback: (entry: ResizeObserverEntry | null) => void): void;
export function useResizeObserver(elementRef: Ref<HTMLElement>, callback: (entry: ResizeObserverEntry) => void): void;
export function useResizeObserver(elementRef: Ref<HTMLElement[]>, callback: (entries: ResizeObserverEntry[]) => void): void;
export function useResizeObserver(elementRef: Ref<HTMLElement | HTMLElement[] | null>, callback: (entries: any) => void): void {
    const observing = new Set<HTMLElement>();
    const observer = new ResizeObserver((entries) => {
        if (Array.isArray(elementRef.value)) {
            callback(entries);
        } else {
            const el = elementRef.value;
            const entry = entries.find(e => el === e.target);

            if (entry) {
                callback(entry);
            } else if (el === null) {
                callback(null);
            }
        }
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
            } else {
                observe(el);
            }
        } else {
            // Signal no size
            callback(null);
        }
    }, { deep: true });

    onBeforeUnmount(() => {
        cleanWatcher();
        observer.disconnect();
    });
}
