import { ref } from 'vue';
import { KeyMatcher, useKeyDown } from './useKeyDown';
import { useKeyUp } from './useKeyUp';

export function useKeyHold(keyHandler: KeyMatcher) {
    const isPressed = ref(false);

    useKeyDown((key, modifiers) => {
        if (keyHandler(key, modifiers)) {
            isPressed.value = true;
            return true;
        }
        return false;
    });

    useKeyUp((key, modifiers) => {
        if (keyHandler(key, modifiers)) {
            isPressed.value = false;
            return true;
        }
        return false;
    });

    return isPressed;
}
