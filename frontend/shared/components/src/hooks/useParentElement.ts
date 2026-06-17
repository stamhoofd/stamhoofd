import type { MaybeRef, ShallowRef } from 'vue';
import { getCurrentInstance, onMounted, onUpdated, shallowRef, unref, watch } from 'vue';

export function useCurrentElement() {
    const vm = getCurrentInstance()!;
    const el = shallowRef<HTMLElement | SVGAElement | null>(null);

    function update() {
        el.value = vm.proxy!.$el;
    }

    onUpdated(update);
    onMounted(update);

    return el;
}

export function useParentElement(
    element: MaybeRef<HTMLElement | SVGElement | null | undefined> = useCurrentElement(),
): Readonly<ShallowRef<HTMLElement | SVGElement | null | undefined>> {
    const parentElement = shallowRef<HTMLElement | SVGElement | null | undefined>();

    const update = () => {
        const el = unref(element);
        if (el) {
            parentElement.value = el.parentElement;
        }
    };

    onMounted(update);
    watch(() => unref(element), update);

    return parentElement;
}
