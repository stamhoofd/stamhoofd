import { onBeforeUnmount, ref } from "vue";

export function useInterval(method: (data: {stop: () => void}) => unknown, ms: number) {
    const data = {
        stop: () => {
            clearInterval(interval);
        }
    }

    const running = ref(false);
    const handler = async () => {
        if (running.value) {
            return;
        }
        running.value = true;
        try {
            await method(data)
        } catch (e) {
            console.error('Error in useInterval', e)
        }
        running.value = false;
    }
    
    const interval = setInterval(() => {
        handler().catch(console.error)
    }, ms);

    onBeforeUnmount(() => {
        clearInterval(interval);
    });
}
