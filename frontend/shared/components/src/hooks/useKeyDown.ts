import { useFocused } from '@simonbackx/vue-app-navigation';
import { onActivated, onBeforeUnmount, onDeactivated, onMounted, unref } from 'vue';

export type KeyMatcher = (key: string, modifiers: { shift: boolean; ctrl: boolean; alt: boolean; meta: boolean }) => boolean;

export function useKeyDown(keyHandler: KeyMatcher) {
    const isFocused = useFocused();
    const onKey = (event: KeyboardEvent) => {
        if (event.defaultPrevented || event.repeat) {
            return;
        }

        if (!unref(isFocused)) {
            return;
        }

        const key = event.key;

        if (keyHandler(key, {
            shift: event.shiftKey,
            ctrl: event.ctrlKey,
            alt: event.altKey,
            meta: event.metaKey,
        }) === true) {
            event.preventDefault();
        }
    };

    const remove = () => {
        document.removeEventListener('keydown', onKey);
    };

    const add = () => {
        remove();
        document.addEventListener('keydown', onKey);
    };

    onActivated(() => {
        add();
    });

    onMounted(() => {
        add();
    });

    onBeforeUnmount(() => {
        remove();
    });

    onDeactivated(() => {
        remove();
    });
}
