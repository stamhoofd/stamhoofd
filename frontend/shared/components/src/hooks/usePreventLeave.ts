import { onBeforeUnmount, onMounted } from 'vue';

export function usePreventLeave(preventLeaveText: () => string | null) {
    const preventLeave = (event: BeforeUnloadEvent) => {
        const text = preventLeaveText();
        if (text === null) {
            return;
        }
        // Cancel the event
        event.preventDefault(); // If you prevent default behavior in Mozilla Firefox prompt will always be shown

        // Chrome requires returnValue to be set
        event.returnValue = text;

        // This message is not visible on most browsers
        return text;
    };

    onBeforeUnmount(() => {
        window.removeEventListener('beforeunload', preventLeave);
    });

    onMounted(() => {
        window.addEventListener('beforeunload', preventLeave);
    });
}
