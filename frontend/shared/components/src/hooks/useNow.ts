import { onActivated, ref } from 'vue';
import { useVisibilityChange } from './useVisibilityChange.js';

// todo: consider caching this system wide (need to think about the temporary listeners created in useVisibilityChange)
export function useNow() {
    const now = ref(new Date());

    onActivated(() => {
        now.value = new Date();
    });

    useVisibilityChange(() => {
        now.value = new Date();
    });

    return now;
}
