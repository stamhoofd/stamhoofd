import { Ref, ref } from 'vue';
import { useResizeObserver } from '../inputs/hooks/useResizeObserver';

export function useElementWidth(element: Ref<HTMLElement | null>): Ref<number> {
    const width = ref(0);

    useResizeObserver(element, () => {
        width.value = element.value?.clientWidth ?? 0;
    });

    return width;
}
