import type { Ref } from 'vue';
import { ref } from 'vue';
import { useResizeObserver } from '../inputs/hooks/useResizeObserver';

export function useElementSize(element: Ref<HTMLElement | null>): { width: Ref<number>; height: Ref<number> } {
    const width = ref(0);
    const height = ref(0);

    useResizeObserver(element, (entry) => {
        if (entry) {
            width.value = entry.borderBoxSize[0].inlineSize;
            height.value = entry.borderBoxSize[0].blockSize;
        } else {
            width.value = 0;
            height.value = 0;
        }
    });

    return {
        width,
        height,
    };
}
