import { onActivated, onBeforeUnmount, onDeactivated, onMounted } from 'vue';

export function useVisibilityChange(callback: () => void | Promise<void>) {
    let wasVisible = false;

    function isVisible() {
        return document.visibilityState === 'visible' && !document.hidden;
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
        window.addEventListener('focus', onVisibilityChange, { passive: true });
        window.addEventListener('blur', onVisibilityChange, { passive: true });
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
        window.removeEventListener('focus', onVisibilityChange);
        window.removeEventListener('blur', onVisibilityChange);
    }

    onMounted(() => {
        addListeners();
    });

    onActivated(() => {
        addListeners();
    });

    onDeactivated(() => {
        removeListeners();
    });

    onBeforeUnmount(() => {
        removeListeners();
    });
}
