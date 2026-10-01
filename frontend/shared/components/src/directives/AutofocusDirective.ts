import { ViewportHelper } from '#ViewportHelper.ts';
import type { ObjectDirective } from 'vue';

/**
 * Whether the user already focused something in the view (e.g. started typing)
 */
function hasFocusInView(el: HTMLElement) {
    const view = el.closest('.st-view');
    return !!document.activeElement && !!view && view.contains(document.activeElement);
}

export const AutofocusDirective: ObjectDirective<HTMLInputElement, boolean | null | undefined> = {
    // called right before the element is inserted into the DOM.
    beforeMount(el, binding) {
        if (!binding.value) {
            return;
        }

        setTimeout(() => {
            if (!el.isConnected || hasFocusInView(el)) {
                return;
            }

            ViewportHelper.scrollIntoView(el, 'center', true).then(() => {
                // Checked again: the user can focus another input during the scroll
                if (el.isConnected && !hasFocusInView(el)) {
                    el.focus();
                }
            }).catch(console.error);
        }, 300);
    },
};
