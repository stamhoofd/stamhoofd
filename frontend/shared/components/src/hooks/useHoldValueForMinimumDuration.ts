import { ref, Ref, watch } from 'vue';

/**
 * This hook will make sure every value is 'visible' for a minimum duration.
 * Ideally for showing a spinner and preventing quick flashes of showing and hiding spinners
 */
export function useHoldValueForMinimumDuration(watchValue: Ref<string | boolean | number | null>, delay = 200) {
    const newRef = ref(watchValue.value);
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let lastChangedAt = new Date(0);

    watch(watchValue, (newValue, oldValue) => {
        if (oldValue === newValue) {
            return;
        }

        const now = new Date();
        if (now.getTime() - lastChangedAt.getTime() >= delay) {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            lastChangedAt = new Date();
            newRef.value = newValue;
            return;
        }

        const waitFor = delay - (now.getTime() - lastChangedAt.getTime());

        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => {
            lastChangedAt = new Date();
            newRef.value = newValue;
        }, waitFor);
    });

    return newRef;
}
