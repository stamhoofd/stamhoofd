import type { ObjectDirective } from 'vue';

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
                    el.focus();
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
