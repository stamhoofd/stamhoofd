import { useKeyDown } from './useKeyDown';

export function useArrowUpDown(actions: { up: () => unknown | Promise<void>; down: () => unknown | Promise<void> }) {
    return useKeyDown((key) => {
        if (key === 'ArrowLeft' || key === 'ArrowUp' || key === 'PageUp') {
            void actions.up();
            return true;
        }
        else if (key === 'ArrowRight' || key === 'ArrowDown' || key === 'PageDown') {
            void actions.down();
            return true;
        }
        return false;
    });
}
