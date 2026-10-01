import { useFocused } from '@simonbackx/vue-app-navigation';
import { onActivated, onBeforeUnmount, onDeactivated, onMounted, watch } from 'vue';

export function useVisibilityChange(
    callback: () => void | Promise<void>,
    onHide?: () => void | Promise<void>,
    immediate = false,
    options: { onFocusChange?: boolean } = {},
) {
    let wasVisible = true;
    let isMountedAndActive = false;
    const focused = options?.onFocusChange ? useFocused() : { value: true };

    // Switching to another application keeps the document visible, so window focus is tracked separately
    let windowFocused = document.hasFocus();

    function isVisible() {
        return document.visibilityState === 'visible' && !document.hidden && windowFocused && focused.value && isMountedAndActive;
    }

    function onWindowFocus() {
        windowFocused = true;
        onVisibilityChange();
    }

    function onWindowBlur() {
        // Focus moved into an iframe of this page
        if (document.activeElement instanceof HTMLIFrameElement) {
            return;
        }
        windowFocused = false;
        onVisibilityChange();
    }

    if (options.onFocusChange) {
        watch(focused, () => {
            onVisibilityChange();
        });
    }

    function onVisibilityChange() {
        const v = isVisible();
        if (v === wasVisible) {
            return;
        }
        wasVisible = v;
        if (v) {
            console.log('[useVisibilityChange] visible');
            const result = callback();
            if (result instanceof Promise) {
                result.catch(console.error);
            }
        }
        else {
            console.log('[useVisibilityChange] hidden');
            if (onHide) {
                const result = onHide();
                if (result instanceof Promise) {
                    result.catch(console.error);
                }
            }
        }
    }

    let listener = false;

    function addListeners() {
        if (listener) {
            return;
        }
        listener = true;
        document.addEventListener('visibilitychange', onVisibilityChange, { passive: true });

        // extra event listeners for better behaviour
        document.addEventListener('focus', onVisibilityChange, { passive: true });
        document.addEventListener('blur', onVisibilityChange, { passive: true });
        window.addEventListener('focus', onWindowFocus, { passive: true });
        window.addEventListener('blur', onWindowBlur, { passive: true });
    }

    function removeListeners() {
        if (!listener) {
            return;
        }
        listener = false;
        document.removeEventListener('visibilitychange', onVisibilityChange);

        // extra event listeners for better behaviour
        document.removeEventListener('focus', onVisibilityChange);
        document.removeEventListener('blur', onVisibilityChange);
        window.removeEventListener('focus', onWindowFocus);
        window.removeEventListener('blur', onWindowBlur);
    }

    onMounted(() => {
        isMountedAndActive = true;
        windowFocused = document.hasFocus();
        addListeners();
        if (immediate) {
            onVisibilityChange();
        }
    });

    onActivated(() => {
        isMountedAndActive = true;
        // The listeners were removed while deactivated
        windowFocused = document.hasFocus();
        addListeners();
        onVisibilityChange();
    });

    onDeactivated(() => {
        isMountedAndActive = false;
        removeListeners();
        onVisibilityChange();
    });

    onBeforeUnmount(() => {
        isMountedAndActive = false;
        removeListeners();
        onVisibilityChange();
    });
}
