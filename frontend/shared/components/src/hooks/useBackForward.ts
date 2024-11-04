import { ComponentWithProperties, useShow } from '@simonbackx/vue-app-navigation';
import { computed, getCurrentInstance, Ref } from 'vue';
import { useKeyUpDown } from './useKeyUpDown';

export function useBackForward<T, Name extends string, Props>(name: Name, props: Props & {
    getPrevious: ((current: T) => T | null) | null;
    getNext: ((current: T) => T | null) | null;
} & Record<Name, T>, otherProps?: Ref<Partial<Props>>) {
    useKeyUpDown({
        up: goBack,
        down: goForward,
    });
    const show = useShow();

    const hasPrevious = computed(() => {
        if (!props.getPrevious) {
            return false;
        }
        return !!props.getPrevious(props[name]);
    });

    const hasNext = computed(() => {
        if (!props.getNext) {
            return false;
        }
        return !!props.getNext(props[name]);
    });

    const instance = getCurrentInstance();
    async function seek(previous = true) {
        const object = previous ? props.getPrevious?.(props[name]) : props.getNext?.(props[name]);

        if (!object) {
            return;
        }
        const component = new ComponentWithProperties(instance!.type, {
            ...props,
            ...otherProps?.value,
            [name]: object,
        });

        await show({
            components: [component],
            replace: 1,
            reverse: previous,
            animated: false,
        });
    }

    async function goBack() {
        await seek(true);
    }

    async function goForward() {
        await seek(false);
    }

    return {
        hasNext,
        hasPrevious,
        goBack,
        goForward,
    };
}
