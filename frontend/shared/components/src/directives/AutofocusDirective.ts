import { ViewportHelper } from '#ViewportHelper.ts';
import type { ObjectDirective } from 'vue';

function isInScrollViewport(el: HTMLElement) {
    const scrollElement = ViewportHelper.getScrollElement(el);
    const elRect = el.getBoundingClientRect();
    const scrollRect = scrollElement === document.documentElement
        ? { top: 0, bottom: window.innerHeight }
        : scrollElement.getBoundingClientRect();
    return elRect.top >= scrollRect.top && elRect.bottom <= scrollRect.bottom;
}

export const AutofocusDirective: ObjectDirective<HTMLInputElement, boolean | null | undefined> = {
    // called right before the element is inserted into the DOM.
    beforeMount(el, binding) {
        if (!binding.value) {
            return;
        }

        setTimeout(() => {
            if (el.isConnected) {
                const view = el.closest('.st-view');
                if (!document.activeElement || !view || !view.contains(document.activeElement)) {
                    // only focus if the user isn't typing already (causes flaky playwright tests)
                    // and never scroll to reach the input: on mobile it can be far below the fold
                    if (isInScrollViewport(el)) {
                        el.focus({ preventScroll: true });
                    }
                }
            }
        }, 300);
    },
};

/**
onMounted(() => {
    if (props.initialEmail.length === 0) {
        setTimeout(() => {
            animating.value = false;
            if (emailInput.value && (!document.activeElement || (!el.value || !el.value.contains(document.activeElement)))) {
                // only focus if the user isn't typing already (causes flaky playwright tests)
                emailInput.value.focus();
            }
        }, 300);
    } else {
        setTimeout(() => {
            animating.value = false;
        }, 300);
    }
});
 */
