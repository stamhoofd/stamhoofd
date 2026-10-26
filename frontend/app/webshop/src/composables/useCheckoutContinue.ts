import type { InjectionKey, ShallowRef } from 'vue';
import { inject, onActivated, onDeactivated, onMounted, onUnmounted, provide, shallowRef } from 'vue';

type ContinueHandler = () => unknown;

const key = Symbol('checkoutContinue') as InjectionKey<ShallowRef<ContinueHandler | null>>;

/**
 * Holds the continue action of the visible checkout view, so the checkout progress can go to the next step.
 */
export function useProvideCheckoutContinue() {
    const handler = shallowRef<ContinueHandler | null>(null);
    provide(key, handler);
    return handler;
}

/**
 * Registers the action of the view's own continue button while the view is visible.
 * Views below the top of the navigation stack are deactivated, so the registered action is always the one of the visible view.
 */
export function useCheckoutContinue(handler: ContinueHandler) {
    const current = inject(key, null);
    if (!current) {
        return;
    }

    const register = () => {
        current.value = handler;
    };
    // The next view can register before this one deactivates: only clear our own action
    const unregister = () => {
        if (current.value === handler) {
            current.value = null;
        }
    };

    onMounted(register);
    onActivated(register);
    onDeactivated(unregister);
    onUnmounted(unregister);
}
