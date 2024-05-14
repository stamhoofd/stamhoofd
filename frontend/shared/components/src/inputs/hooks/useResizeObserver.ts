import { onBeforeUnmount, Ref, watch } from "vue";


export function useResizeObserver(elementRef: Ref<HTMLElement|null>, callback: () => void) {
    const observer = new ResizeObserver((entries) => {
        callback();
    });

    watch(elementRef, (el) => {
        if (el) {
            observer.observe(el);
        } else {
            observer.disconnect();
        }
    });

    onBeforeUnmount(() => {
        observer.disconnect();
    });
}
